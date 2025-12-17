from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class ICP(BaseModel):
    """Ideal Customer Profile"""
    industries: List[str] = []
    companySizes: List[str] = []
    titles: List[str] = []
    geographies: List[str] = []
    technologies: List[str] = []
    painPoints: List[str] = []
    buyingSignals: List[str] = []
    budgetRange: Optional[str] = None
    decisionMakers: List[str] = []

class Strategy(BaseModel):
    """Sales Strategy"""
    approach: str = "consultative"  # consultative, challenger, solution, relationship
    primaryChannel: str = "email"  # email, phone, linkedin, multi-channel
    cadence: str = "balanced"  # aggressive, balanced, passive
    personalization: str = "high"  # low, medium, high
    automationLevel: str = "guided"  # manual, guided, autonomous
    focusAreas: List[str] = []
    messagingPillars: List[str] = []
    differentiators: List[str] = []
    objectionHandlers: Dict[str, str] = {}

class OnboardingProfileCreate(BaseModel):
    companyName: Optional[str] = None
    companyDomain: Optional[str] = None
    industry: Optional[str] = None
    companySize: Optional[str] = None
    role: Optional[str] = None
    primaryGoal: Optional[str] = None

class OnboardingProfile(BaseModel):
    id: str
    userId: str
    step: int = 1
    isComplete: bool = False
    
    # Company info (gathered or researched)
    companyName: Optional[str] = None
    companyDomain: Optional[str] = None
    industry: Optional[str] = None
    companySize: Optional[str] = None
    companyDescription: Optional[str] = None
    valueProposition: Optional[str] = None
    competitors: List[str] = []
    
    # AI-researched data
    aiResearch: Optional[Dict[str, Any]] = None
    aiResearchedAt: Optional[datetime] = None
    
    # User-defined or AI-suggested ICP
    icp: Optional[ICP] = None
    icpApproved: bool = False
    
    # User-defined or AI-suggested Strategy
    strategy: Optional[Strategy] = None
    strategyApproved: bool = False
    
    # User preferences
    role: Optional[str] = None
    primaryGoal: Optional[str] = None
    
    createdAt: datetime
    updatedAt: datetime
