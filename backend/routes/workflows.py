from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List

from database import get_db
from models.workflow import Workflow, WorkflowCreate, WorkflowExecution
from routes.auth import get_current_user

router = APIRouter()

@router.get("")
async def get_workflows(
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
    
    workflows = await db.workflows.find(query, {"_id": 0}).to_list(100)
    return workflows

@router.post("")
async def create_workflow(workflow_data: WorkflowCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    now = datetime.now(timezone.utc)
    workflow = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": workflow_data.name,
        "description": workflow_data.description,
        "nlpDescription": workflow_data.nlpDescription,
        "status": "draft",
        "triggerType": workflow_data.triggerType,
        "triggerConfig": workflow_data.triggerConfig,
        "nodes": [n.dict() for n in workflow_data.nodes],
        "edges": [e.dict() for e in workflow_data.edges],
        "category": workflow_data.category,
        "isTemplate": False,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.workflows.insert_one(workflow)
    del workflow["_id"] if "_id" in workflow else None
    return workflow

@router.get("/templates")
async def get_workflow_templates(
    category: Optional[str] = None,
    limit: int = Query(default=20, le=50)
):
    db = get_db()
    
    query = {"isTemplate": True}
    if category:
        query["category"] = category
    
    templates = await db.workflow_templates.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return templates

@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    workflow = await db.workflows.find_one(
        {"id": workflow_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}")
async def update_workflow(workflow_id: str, updates: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    workflow = await db.workflows.find_one({"id": workflow_id, "userId": current_user["id"]})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.workflows.update_one({"id": workflow_id}, {"$set": updates})
    
    updated = await db.workflows.find_one({"id": workflow_id}, {"_id": 0})
    return updated

@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    result = await db.workflows.delete_one({"id": workflow_id, "userId": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    return {"success": True, "message": "Workflow deleted"}

@router.post("/{workflow_id}/execute")
async def execute_workflow(
    workflow_id: str,
    context: dict = {},
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    workflow = await db.workflows.find_one({"id": workflow_id, "userId": current_user["id"]})
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    now = datetime.now(timezone.utc)
    execution = {
        "id": str(uuid4()),
        "workflowId": workflow_id,
        "userId": current_user["id"],
        "status": "running",
        "currentNodeId": workflow["nodes"][0]["id"] if workflow["nodes"] else None,
        "context": context,
        "logs": [],
        "error": None,
        "startedAt": now.isoformat(),
        "completedAt": None,
        "executionTime": None
    }
    
    await db.workflow_executions.insert_one(execution)
    
    # TODO: Actually execute workflow nodes
    # For now, mark as completed
    execution["status"] = "completed"
    execution["completedAt"] = datetime.now(timezone.utc).isoformat()
    execution["logs"].append({"message": "Workflow executed successfully", "timestamp": now.isoformat()})
    
    await db.workflow_executions.update_one(
        {"id": execution["id"]},
        {"$set": execution}
    )
    
    del execution["_id"] if "_id" in execution else None
    return execution

@router.get("/{workflow_id}/executions")
async def get_workflow_executions(
    workflow_id: str,
    status: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {"workflowId": workflow_id, "userId": current_user["id"]}
    if status:
        query["status"] = status
    
    executions = await db.workflow_executions.find(
        query, {"_id": 0}
    ).sort("startedAt", -1).limit(limit).to_list(limit)
    
    return executions

@router.post("/generate")
async def generate_workflow_from_nlp(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate a workflow from natural language description"""
    description = request.get("description", "")
    
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    
    # TODO: Use Gemini to generate workflow from description
    # For now, return a mock workflow structure
    
    workflow = {
        "name": f"Generated: {description[:50]}...",
        "description": description,
        "nlpDescription": description,
        "nodes": [
            {"id": "start", "type": "trigger", "config": {}, "position": {"x": 0, "y": 0}},
            {"id": "action1", "type": "action", "config": {}, "position": {"x": 200, "y": 0}},
            {"id": "end", "type": "end", "config": {}, "position": {"x": 400, "y": 0}}
        ],
        "edges": [
            {"id": "e1", "source": "start", "target": "action1"},
            {"id": "e2", "source": "action1", "target": "end"}
        ],
        "category": "sales"
    }
    
    return workflow
