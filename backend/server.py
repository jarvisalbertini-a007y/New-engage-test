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
from routes.universal_chat import router as universal_chat_router
from routes.micro_agents import router as micro_agents_router
from routes.knowledge import router as knowledge_router
from routes.workflow_templates import router as workflow_templates_router
from routes.smart_onboarding import router as smart_onboarding_router
from routes.settings import router as settings_router
from routes.agent_teams import router as agent_teams_router
from routes.execution_engine import router as execution_router
from routes.real_integrations import router as integrations_router
from routes.google_integration import router as google_router
from routes.autonomous_prospecting import router as autonomous_router
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
app.include_router(universal_chat_router, prefix="/api/chat", tags=["Universal Chat"])
app.include_router(micro_agents_router, prefix="/api/micro-agents", tags=["Micro Agents"])
app.include_router(knowledge_router, prefix="/api/knowledge", tags=["Knowledge Base"])
app.include_router(workflow_templates_router, prefix="/api/workflow-templates", tags=["Workflow Templates"])
app.include_router(smart_onboarding_router, prefix="/api/smart-onboarding", tags=["Smart Onboarding"])
app.include_router(settings_router, prefix="/api/settings", tags=["Settings"])
app.include_router(agent_teams_router, prefix="/api/agent-teams", tags=["Agent Teams"])
app.include_router(execution_router, prefix="/api/execute", tags=["Execution Engine"])
app.include_router(integrations_router, prefix="/api/integrations", tags=["Integrations"])
app.include_router(google_router, prefix="/api/google", tags=["Google Integration"])
app.include_router(autonomous_router, prefix="/api/autonomous", tags=["Autonomous Prospecting"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "EngageAI Sales Engine", "version": "1.0.0"}

@app.get("/api")
async def root():
    return {
        "message": "EngageAI Sales Engine API",
        "version": "1.0.0",
        "docs": "/docs"
    }
