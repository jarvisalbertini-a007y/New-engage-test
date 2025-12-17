from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class AgentTier(str, Enum):
    WORKER = "worker"
    SPECIALIST = "specialist"
    LEADER = "leader"

class AgentCategory(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    parentId: Optional[str] = None

class AgentTemplate(BaseModel):
    id: str
    name: str
    slug: str
    description: str
    longDescription: Optional[str] = None
    tier: str = "worker"
    domain: str
    complexity: str = "simple"
    capabilities: List[str] = []
    requiredIntegrations: List[str] = []
    systemPrompt: Optional[str] = None
    tags: List[str] = []
    usageCount: int = 0
    rating: float = 0.0
    createdAt: datetime

class AgentCreate(BaseModel):
    name: str
    templateId: Optional[str] = None
    description: Optional[str] = None
    category: str
    tier: str = "worker"
    status: str = "active"
    config: Dict[str, Any] = {}
    systemPrompt: Optional[str] = None

class Agent(BaseModel):
    id: str
    userId: str
    name: str
    templateId: Optional[str] = None
    description: Optional[str] = None
    category: str
    tier: str = "worker"
    status: str = "active"
    config: Dict[str, Any] = {}
    systemPrompt: Optional[str] = None
    metrics: Dict[str, Any] = {}
    lastRun: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime

class AgentExecution(BaseModel):
    id: str
    agentId: str
    userId: str
    status: str = "pending"
    input: Dict[str, Any] = {}
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    duration: Optional[int] = None
