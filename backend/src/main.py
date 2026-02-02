import os
from logging import Logger
from fastapi import FastAPI, HTTPException
from prisma import Prisma
from pydantic import BaseModel
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from src.services.investigator import OSINTInvestigatorService

# Load environment variables
load_dotenv()

# Initialize Prisma client
db = Prisma()
logger = Logger(__name__)
frontend_url = os.getenv("FRONTEND_URL")

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

# Configure CORS (must allow request origin or OPTIONS preflight returns 400)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/")
async def root():
    return {"message": "Backend API is running"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected"}


# Example endpoint using Prisma
@app.get("/users")
async def get_users():
    users = await db.user.find_many()
    return {"users": users}


@app.post("/users")
async def create_user(email: str, name: str = None):
    user = await db.user.create(data={"email": email, "name": name})
    return {"user": user}


class InvestigateRequest(BaseModel):
    query: str


@app.post("/investigate")
async def investigate(body: InvestigateRequest):
    query = body.query
    try:
        logger.info(f"Investigating query: {query}")
        # investigation = await OSINTInvestigatorService().investigation_report(query)
        investigation = """# Investigation Report: The investigation aims to map the infrastructure used by Iran to bypass international sanctions on its petrochemical sector, focusing on the producer-broker-shipper nexus and specific maritime deceptive practices.

## Executive Summary
Iran has established a sophisticated 'shadow' ecosystem to export petrochemicals, generating billions in revenue despite US and international sanctions. This network relies on three pillars: state-linked producers, a global web of brokers/front companies, and a 'ghost fleet' of tankers using deceptive maritime practices.

## Detailed Analysis
### 1. Producer and Broker Networks
The core of the evasion network is the **Persian Gulf Petrochemical Industries Company (PGPIC)**, which accounts for nearly half of Iran’s petrochemical export capacity. To move product, PGPIC utilizes brokers like **Triliance Petrochemical Co. Ltd**, based in Hong Kong but with extensive operations in the UAE. Triliance acts as a central clearinghouse, purchasing Iranian products and reselling them to international buyers under falsified certificates of origin. 

### 2. Financial Intermediaries
Brokers use a 'shadow banking' system consisting of exchange houses and front companies (e.g., **Edgar Commercial Solutions** in the UAE). These entities mask the Iranian origin of funds by co-mingling them with legitimate trade revenue, often using local currencies or non-SWIFT channels to avoid detection by Western compliance monitors.

### 3. Maritime Concealment Patterns
The 'Ghost Fleet'—a collection of aging tankers often registered under flags of convenience (Comoros, Cook Islands, Palau)—employs several tactics:
- **AIS Spoofing:** Vessels transmit false GPS coordinates to appear in one location while actually loading cargo at Iranian ports like Assaluyeh.
- **Ship-to-Ship (STS) Transfers:** Iranian cargo is transferred to non-sanctioned vessels in international waters (often off the coast of Malaysia or the UAE) to 'clean' the product's trail.
- **Flag Hopping:** Frequent changes in vessel registration and name to evade tracking databases.

## Risk Factors
- Secondary sanctions risk for maritime insurers and port operators.
- Environmental hazards due to unregulated STS transfers involving aging vessels.
- Legal exposure for financial institutions processing payments for front companies.

## References
- 1. US Department of the Treasury (OFAC) Press Release, June 2022.
- 2. United Against Nuclear Iran (UANI) Ghost Fleet Database.
- 3. Wall Street Journal Investigation into Iranian Shadow Banking, 2022.
- 4. Lloyd's List Intelligence Maritime Data Reports.


"""
        geolocations = [
            {
                "entity": "Assaluyeh Petrochemical Complex",
                "coordinates": [27.4772, 52.6164],
                "context": "Major production hub for Iranian petrochemicals and gas.",
            },
            {
                "entity": "Bandar Imam Khomeini",
                "coordinates": [30.4356, 49.0656],
                "context": "Primary shipping port for petrochemical exports.",
            },
            {
                "entity": "Sharjah, United Arab Emirates",
                "coordinates": [25.3463, 55.4209],
                "context": "Regional hub for front companies and brokers like Triliance.",
            },
            {
                "entity": "Malacca Strait",
                "coordinates": [2.5, 101.5],
                "context": "Frequent site for Ship-to-Ship (STS) transfers to conceal cargo origin.",
            },
            {
                "entity": "Hong Kong",
                "coordinates": [22.3193, 114.1694],
                "context": "Financial node for shell companies facilitating payments.",
            },
        ]
        news_and_sources = [
            {
                "title": "Treasury Sanctions International Network Supporting Iran’s Petrochemical and Oil Sales",
                "url": "https://home.treasury.gov/news/press-releases/jy0813",
                "date": "2022-06-16",
                "key_insight": "Identifies Triliance Petrochemical and its network of front companies in the UAE and Hong Kong.",
            },
            {
                "title": "Iran's Ghost Fleet: The tankers carrying sanctioned oil",
                "url": "https://www.uani.com/ghost-fleet-tankers",
                "date": "2023-11-15",
                "key_insight": "Detailed tracking of vessels using AIS spoofing and flag-hopping to move Iranian products.",
            },
            {
                "title": "The Shadow Banking System Powering Iran's Sanctions Evasion",
                "url": "https://www.wsj.com/articles/iran-uses-shadow-banking-network-to-keep-economy-afloat-despite-sanctions-11655993156",
                "date": "2022-06-23",
                "key_insight": "Explains the financial architecture used to clear transactions outside the Western banking system.",
            },
        ]
        results = {
            "formatted_report": investigation,
            "geolocations": geolocations,
            "news_and_sources": news_and_sources,
        }
        logger.info(f"Investigation report:")
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
