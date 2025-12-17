from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List

from database import get_db
from models.agent import Agent, AgentCreate, AgentCategory, AgentTemplate, AgentExecution
from routes.auth import get_current_user

router = APIRouter()

# Agent Categories
CATEGORIES = [
    {"id": "prospecting", "name": "Prospecting", "slug": "prospecting", "description": "Find and identify potential leads", "icon": "Search", "color": "#3B82F6"},
    {"id": "research", "name": "Research", "slug": "research", "description": "Gather intelligence on companies and contacts", "icon": "FileSearch", "color": "#8B5CF6"},
    {"id": "outreach", "name": "Outreach", "slug": "outreach", "description": "Multi-channel communication automation", "icon": "Send", "color": "#10B981"},
    {"id": "qualification", "name": "Qualification", "slug": "qualification", "description": "Score and qualify leads", "icon": "CheckCircle", "color": "#F59E0B"},
    {"id": "scheduling", "name": "Scheduling", "slug": "scheduling", "description": "Calendar and meeting automation", "icon": "Calendar", "color": "#EC4899"},
    {"id": "content", "name": "Content", "slug": "content", "description": "Generate and personalize content", "icon": "FileText", "color": "#6366F1"},
    {"id": "analysis", "name": "Analysis", "slug": "analysis", "description": "Data analysis and reporting", "icon": "BarChart", "color": "#14B8A6"},
    {"id": "integration", "name": "Integration", "slug": "integration", "description": "Connect with external systems", "icon": "Link", "color": "#F97316"},
    {"id": "management", "name": "Management", "slug": "management", "description": "Team and workflow coordination", "icon": "Users", "color": "#EF4444"},
    {"id": "data", "name": "Data", "slug": "data", "description": "Data enrichment and validation", "icon": "Database", "color": "#84CC16"},
]

@router.get("/categories")
async def get_categories():
    return CATEGORIES

@router.get("/templates")
async def get_templates(
    category: Optional[str] = None,
    tier: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100)
):
    db = get_db()
    
    query = {}
    if category:
        query["domain"] = category
    if tier:
        query["tier"] = tier
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}}
        ]
    
    templates = await db.agent_templates.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return templates

@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    db = get_db()
    template = await db.agent_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.get("")
async def get_agents(
    status: Optional[str] = None,
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    if category:
        query["category"] = category
    
    agents = await db.agents.find(query, {"_id": 0}).to_list(100)
    return agents

@router.post("")
async def create_agent(agent_data: AgentCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    now = datetime.now(timezone.utc)
    agent = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": agent_data.name,
        "templateId": agent_data.templateId,
        "description": agent_data.description,
        "category": agent_data.category,
        "tier": agent_data.tier,
        "status": agent_data.status,
        "config": agent_data.config,
        "systemPrompt": agent_data.systemPrompt,
        "metrics": {"tasksCompleted": 0, "successRate": 0},
        "lastRun": None,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.agents.insert_one(agent)
    agent.pop("_id", None)
    return agent

@router.get("/{agent_id}")
async def get_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    agent = await db.agents.find_one(
        {"id": agent_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.put("/{agent_id}")
async def update_agent(agent_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    # Verify ownership
    agent = await db.agents.find_one({"id": agent_id, "userId": current_user["id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.agents.update_one({"id": agent_id}, {"$set": updates})
    
    updated = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    return updated

@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    result = await db.agents.delete_one({"id": agent_id, "userId": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    return {"success": True, "message": "Agent deleted"}

@router.post("/{agent_id}/execute")
async def execute_agent(
    agent_id: str,
    input_data: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    # Get agent
    agent = await db.agents.find_one({"id": agent_id, "userId": current_user["id"]})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    if agent["status"] != "active":
        raise HTTPException(status_code=400, detail="Agent is not active")
    
    # Create execution record
    now = datetime.now(timezone.utc)
    execution = {
        "id": str(uuid4()),
        "agentId": agent_id,
        "userId": current_user["id"],
        "status": "pending",
        "input": input_data,
        "output": None,
        "error": None,
        "startedAt": now.isoformat(),
        "completedAt": None,
        "duration": None
    }
    
    await db.agent_executions.insert_one(execution)
    
    # TODO: Actually execute the agent with AI
    # For now, mark as completed with mock output
    execution["status"] = "completed"
    execution["output"] = {"message": "Agent executed successfully", "result": {}}
    execution["completedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.agent_executions.update_one(
        {"id": execution["id"]},
        {"$set": execution}
    )
    
    execution.pop("_id", None)
    return execution

@router.get("/{agent_id}/executions")
async def get_agent_executions(
    agent_id: str,
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {"agentId": agent_id, "userId": current_user["id"]}
    if status:
        query["status"] = status
    
    executions = await db.agent_executions.find(
        query, {"_id": 0}
    ).sort("startedAt", -1).limit(limit).to_list(limit)
    
    return executions

@router.get("/metrics/summary")
async def get_metrics_summary(current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    agents = await db.agents.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    active_count = len([a for a in agents if a.get("status") == "active"])
    total_tasks = sum(a.get("metrics", {}).get("tasksCompleted", 0) for a in agents)
    
    return {
        "totalAgents": len(agents),
        "activeAgents": active_count,
        "totalTasksCompleted": total_tasks,
        "avgSuccessRate": 0  # TODO: Calculate
    }
