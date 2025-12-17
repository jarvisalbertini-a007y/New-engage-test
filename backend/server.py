from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from routes.auth import router as auth_router
from routes.agents import router as agents_router
from routes.workflows import router as workflows_router
from routes.onboarding import router as onboarding_router
from routes.prospects import router as prospects_router
from routes.content import router as content_router
from routes.command import router as command_router
from database import connect_db, close_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_db()
    yield
    # Shutdown
    await close_db()

app = FastAPI(
    title="EngageAI Sales Engine",
    description="Autonomous AI Sales Engine with 1000+ Agents",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(agents_router, prefix="/api/agents", tags=["Agents"])
app.include_router(workflows_router, prefix="/api/workflows", tags=["Workflows"])
app.include_router(onboarding_router, prefix="/api/onboarding", tags=["Onboarding"])
app.include_router(prospects_router, prefix="/api/prospects", tags=["Prospects"])
app.include_router(content_router, prefix="/api/content", tags=["Content"])
app.include_router(command_router, prefix="/api/command", tags=["Command Center"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "EngageAI Sales Engine"}

@app.get("/api")
async def root():
    return {
        "message": "EngageAI Sales Engine API",
        "version": "1.0.0",
        "docs": "/docs"
    }
