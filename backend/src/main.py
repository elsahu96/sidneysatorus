from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prisma import Prisma
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Prisma client
db = Prisma()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to database on startup
    await db.connect()
    yield
    # Disconnect on shutdown
    await db.disconnect()


# Initialize FastAPI app
app = FastAPI(title="Lovable Backend API", version="1.0.0", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],  # Adjust for your frontend URL
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


