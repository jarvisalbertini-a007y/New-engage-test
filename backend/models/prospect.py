from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class CompanyCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = []
    linkedinUrl: Optional[str] = None

class Company(BaseModel):
    id: str
    userId: Optional[str] = None
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    location: Optional[str] = None
    revenue: Optional[str] = None
    description: Optional[str] = None
    technologies: List[str] = []
    linkedinUrl: Optional[str] = None
    aiProfile: Optional[Dict[str, Any]] = None
    createdAt: datetime

class ProspectCreate(BaseModel):
    email: EmailStr
    firstName: str
    lastName: str
    companyId: Optional[str] = None
    title: Optional[str] = None
    linkedinUrl: Optional[str] = None
    phoneNumber: Optional[str] = None

class Prospect(BaseModel):
    id: str
    userId: str
    email: str
    firstName: str
    lastName: str
    companyId: Optional[str] = None
    company: Optional[Company] = None
    title: Optional[str] = None
    linkedinUrl: Optional[str] = None
    phoneNumber: Optional[str] = None
    status: str = "new"
    score: int = 0
    isVerified: bool = False
    tags: List[str] = []
    lastContactedAt: Optional[datetime] = None
    createdAt: datetime
    updatedAt: datetime
