import os
from logging import Logger
from fastapi import FastAPI, HTTPException, Depends, Request
from prisma import Prisma
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from src.services.investigator import OSINTInvestigatorService
from src.auth import get_current_user_and_team
from src.deps import db, get_db
from src.routers import case_files as case_files_router

# Load environment variables
load_dotenv()

logger = Logger(__name__)
frontend_url = os.getenv("FRONTEND_URL")


def _is_connection_closed_error(exc: BaseException) -> bool:
    """True if the exception indicates the PostgreSQL connection was closed (e.g. idle timeout)."""
    msg = str(exc).lower()
    return (
        "closed" in msg
        or "connection" in msg and ("closed" in msg or "reset" in msg or "refused" in msg)
        or "quaint" in msg and "connection" in msg
    )


async def _ensure_db_connected() -> bool:
    """If the DB connection is closed, disconnect and reconnect. Returns True if connected."""
    try:
        await db.user.find_first(take=1)
        return True
    except Exception as e:
        if _is_connection_closed_error(e):
            logger.warning("Database connection closed, reconnecting: %s", e)
            try:
                await db.disconnect()
            except Exception:
                pass
            try:
                await db.connect()
                return True
            except Exception as reconnect_err:
                logger.error("Reconnect failed: %s", reconnect_err)
                return False
        raise
    return False

# # CORS: allow FRONTEND_URL plus common dev origins so preflight OPTIONS succeeds
# _cors_origins = [
#     o
#     for o in [
#         frontend_url,
#         "http://localhost:4567",
#         "http://localhost:5173",
#         "http://localhost:3000",
#         "http://127.0.0.1:4567",
#         "http://127.0.0.1:5173",
#         "http://127.0.0.1:3000",
#     ]
#     if o
# ]
# # Deduplicate while preserving order
# _cors_origins = list(dict.fromkeys(_cors_origins))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to database on startup
    await db.connect()
    yield
    # Disconnect on shutdown
    await db.disconnect()


# Initialize FastAPI app
app = FastAPI(title="Sidney Backend API", version="1.0.0", lifespan=lifespan)


@app.exception_handler(Exception)
async def prisma_connection_exception_handler(request: Request, exc: Exception):
    """On PostgreSQL connection closed errors, reconnect and ask client to retry. Other errors return 500."""
    if not _is_connection_closed_error(exc):
        logger.exception("Unhandled exception")
        return JSONResponse(status_code=500, content={"detail": str(exc)})
    logger.warning("Request failed due to closed DB connection, reconnecting: %s", exc)
    try:
        await db.disconnect()
    except Exception:
        pass
    try:
        await db.connect()
        return JSONResponse(
            status_code=503,
            content={
                "detail": "Database connection was closed; reconnected. Please retry your request.",
            },
        )
    except Exception as e:
        logger.error("Reconnect failed: %s", e)
        return JSONResponse(
            status_code=503,
            content={"detail": "Database temporarily unavailable. Please try again later."},
        )


# Configure CORS (must allow request origin or OPTIONS preflight returns 400)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def require_auth(request: Request, database: Prisma = Depends(get_db)):
    """Verify Supabase JWT and return (user_id, team_id)."""
    return await get_current_user_and_team(request, database)


app.include_router(case_files_router.router)


# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Backend API is running"}


@app.get("/health")
async def health_check():
    """Health check; pings DB and reconnects if connection was closed."""
    try:
        connected = await _ensure_db_connected()
        if not connected:
            return JSONResponse(
                status_code=503,
                content={"status": "unhealthy", "database": "reconnect_failed"},
            )
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        if _is_connection_closed_error(e):
            try:
                await db.disconnect()
                await db.connect()
                return {"status": "healthy", "database": "reconnected"}
            except Exception:
                return JSONResponse(
                    status_code=503,
                    content={"status": "unhealthy", "database": "error"},
                )
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": str(e)},
        )


@app.get("/me")
async def me(current_user: tuple[str, str] = Depends(require_auth)):
    """Return current user and team (requires Supabase Bearer token)."""
    user_id, team_id = current_user
    user = await db.user.find_unique(
        where={"id": user_id}, include={"memberships": {"include": {"team": True}}}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    team = user.memberships[0].team if user.memberships else None
    return {
        "user_id": user_id,
        "team_id": team_id,
        "email": user.email,
        "name": user.name,
        "team_name": team.name if team else None,
    }


# Example endpoint using Prisma
@app.get("/users")
async def get_users():
    users = await db.user.find_many()
    return {"users": users}


@app.post("/users")
async def create_user(email: str, name: str | None = None):
    user = await db.user.create(
        data={
            "email": email,
            "name": name or email.split("@")[0],
            "username": email.split("@")[0],
        }
    )
    return {"user": user}


class InvestigateRequest(BaseModel):
    query: str


@app.post("/investigate")
async def investigate(body: InvestigateRequest):
    query = body.query
    try:
        # Validate query
        if not query or not query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        # Initialize service with error handling
        try:
            service = OSINTInvestigatorService(
                use_multi_agent=False
            )  # Use legacy for now to avoid ADK issues
        except ValueError as e:
            # Missing API key
            logger.error(f"Service initialization error: {e}")
            raise HTTPException(
                status_code=500, detail=f"Service configuration error: {str(e)}"
            )
        except Exception as e:
            # Other initialization errors
            logger.error(f"Service initialization error: {e}")
            import traceback

            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500, detail=f"Service initialization failed: {str(e)}"
            )

        # Call investigation_report with error handling
        try:
            results = await service.investigation_report(query)
        except Exception as e:
            logger.error(f"Investigation error: {e}")
            import traceback

            logger.error(traceback.format_exc())
            raise HTTPException(
                status_code=500, detail=f"Investigation failed: {str(e)}"
            )

        # Validate results structure
        if not isinstance(results, dict):
            logger.error(f"Invalid results type: {type(results)}")
            raise HTTPException(
                status_code=500,
                detail="Invalid response format from investigation service",
            )

        # Ensure required fields are present
        required_fields = [
            "query_understanding",
            "formatted_report",
            "entity_analysis",
            "investigation_type",
            "geolocations",
            "news_and_sources",
        ]
        missing_fields = [f for f in required_fields if f not in results]
        if missing_fields:
            logger.warning(f"Missing fields in results: {missing_fields}")
            # Fill in missing fields with defaults
            for field in missing_fields:
                if field == "formatted_report":
                    results[field] = "# Error\n\nReport generation incomplete."
                elif field == "entity_analysis":
                    results[field] = {"primary_entities": [], "secondary_entities": []}
                elif field in ["geolocations", "news_and_sources"]:
                    results[field] = []
                elif field == "investigation_type":
                    results[field] = "ERROR"
                elif field == "query_understanding":
                    results[field] = query

        #         investigation = """# Investigation Report: The investigation aims to map the infrastructure used by Iran to bypass international sanctions on its petrochemical sector, focusing on the producer-broker-shipper nexus and specific maritime deceptive practices.

        # ## Executive Summary
        # Iran has established a sophisticated 'shadow' ecosystem to export petrochemicals, generating billions in revenue despite US and international sanctions. This network relies on three pillars: state-linked producers, a global web of brokers/front companies, and a 'ghost fleet' of tankers using deceptive maritime practices.

        # ## Detailed Analysis
        # ### 1. Producer and Broker Networks
        # The core of the evasion network is the **Persian Gulf Petrochemical Industries Company (PGPIC)**, which accounts for nearly half of Iran’s petrochemical export capacity. To move product, PGPIC utilizes brokers like **Triliance Petrochemical Co. Ltd**, based in Hong Kong but with extensive operations in the UAE. Triliance acts as a central clearinghouse, purchasing Iranian products and reselling them to international buyers under falsified certificates of origin.

        # ### 2. Financial Intermediaries
        # Brokers use a 'shadow banking' system consisting of exchange houses and front companies (e.g., **Edgar Commercial Solutions** in the UAE). These entities mask the Iranian origin of funds by co-mingling them with legitimate trade revenue, often using local currencies or non-SWIFT channels to avoid detection by Western compliance monitors.

        # ### 3. Maritime Concealment Patterns
        # The 'Ghost Fleet'—a collection of aging tankers often registered under flags of convenience (Comoros, Cook Islands, Palau)—employs several tactics:
        # - **AIS Spoofing:** Vessels transmit false GPS coordinates to appear in one location while actually loading cargo at Iranian ports like Assaluyeh.
        # - **Ship-to-Ship (STS) Transfers:** Iranian cargo is transferred to non-sanctioned vessels in international waters (often off the coast of Malaysia or the UAE) to 'clean' the product's trail.
        # - **Flag Hopping:** Frequent changes in vessel registration and name to evade tracking databases.

        # ## Risk Factors
        # - Secondary sanctions risk for maritime insurers and port operators.
        # - Environmental hazards due to unregulated STS transfers involving aging vessels.
        # - Legal exposure for financial institutions processing payments for front companies.

        # ## References
        # - 1. US Department of the Treasury (OFAC) Press Release, June 2022.
        # - 2. United Against Nuclear Iran (UANI) Ghost Fleet Database.
        # - 3. Wall Street Journal Investigation into Iranian Shadow Banking, 2022.
        # - 4. Lloyd's List Intelligence Maritime Data Reports.

        # """
        #         geolocations = [
        #             {
        #                 "entity": "Assaluyeh Petrochemical Complex",
        #                 "coordinates": [27.4772, 52.6164],
        #                 "context": "Major production hub for Iranian petrochemicals and gas.",
        #             },
        #             {
        #                 "entity": "Bandar Imam Khomeini",
        #                 "coordinates": [30.4356, 49.0656],
        #                 "context": "Primary shipping port for petrochemical exports.",
        #             },
        #             {
        #                 "entity": "Sharjah, United Arab Emirates",
        #                 "coordinates": [25.3463, 55.4209],
        #                 "context": "Regional hub for front companies and brokers like Triliance.",
        #             },
        #             {
        #                 "entity": "Malacca Strait",
        #                 "coordinates": [2.5, 101.5],
        #                 "context": "Frequent site for Ship-to-Ship (STS) transfers to conceal cargo origin.",
        #             },
        #             {
        #                 "entity": "Hong Kong",
        #                 "coordinates": [22.3193, 114.1694],
        #                 "context": "Financial node for shell companies facilitating payments.",
        #             },
        #         ]
        #         news_and_sources = [
        #             {
        #                 "title": "Treasury Sanctions International Network Supporting Iran’s Petrochemical and Oil Sales",
        #                 "url": "https://home.treasury.gov/news/press-releases/jy0813",
        #                 "date": "2022-06-16",
        #                 "key_insight": "Identifies Triliance Petrochemical and its network of front companies in the UAE and Hong Kong.",
        #             },
        #             {
        #                 "title": "Iran's Ghost Fleet: The tankers carrying sanctioned oil",
        #                 "url": "https://www.uani.com/ghost-fleet-tankers",
        #                 "date": "2023-11-15",
        #                 "key_insight": "Detailed tracking of vessels using AIS spoofing and flag-hopping to move Iranian products.",
        #             },
        #             {
        #                 "title": "The Shadow Banking System Powering Iran's Sanctions Evasion",
        #                 "url": "https://www.wsj.com/articles/iran-uses-shadow-banking-network-to-keep-economy-afloat-despite-sanctions-11655993156",
        #                 "date": "2022-06-23",
        #                 "key_insight": "Explains the financial architecture used to clear transactions outside the Western banking system.",
        #             },
        #         ]
        # results = {
        #     "formatted_report": investigation,
        #     "geolocations": geolocations,
        #     "news_and_sources": news_and_sources,
        # }
        logger.info(f"Investigation report:")
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# if __name__ == "__main__":
#     results = asyncio.run(
#         investigate(
#             InvestigateRequest(
#                 query="Map the current sanctions-evasion ecosystem for Iranian petrochemicals, detailing producer and broker networks and maritime concealment patterns"
#             ),
#             current_user=("123", "456"),
#         )
#     )
#     print(results)
