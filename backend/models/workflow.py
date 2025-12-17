from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class WorkflowNode(BaseModel):
    id: str
    type: str
    agentId: Optional[str] = None
    config: Dict[str, Any] = {}
    position: Dict[str, float] = {"x": 0, "y": 0}

class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    condition: Optional[str] = None

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nlpDescription: Optional[str] = None
    triggerType: str = "manual"
    triggerConfig: Dict[str, Any] = {}
    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []
    category: str = "sales"

class Workflow(BaseModel):
    id: str
    userId: str
    name: str
    description: Optional[str] = None
    nlpDescription: Optional[str] = None
    status: str = "draft"
    triggerType: str = "manual"
    triggerConfig: Dict[str, Any] = {}
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    category: str = "sales"
    isTemplate: bool = False
    createdAt: datetime
    updatedAt: datetime

class WorkflowExecution(BaseModel):
    id: str
    workflowId: str
    userId: str
    status: str = "running"
    currentNodeId: Optional[str] = None
    context: Dict[str, Any] = {}
    logs: List[Dict[str, Any]] = []
    error: Optional[str] = None
    startedAt: datetime
    completedAt: Optional[datetime] = None
    executionTime: Optional[int] = None
