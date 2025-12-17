from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List

from database import get_db
from models.prospect import Prospect, ProspectCreate, Company, CompanyCreate
from routes.auth import get_current_user

router = APIRouter()

# Companies
@router.get("/companies")
async def get_companies(
    search: Optional[str] = None,
    industry: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"domain": {"$regex": search, "$options": "i"}}
        ]
    if industry:
        query["industry"] = industry
    
    companies = await db.companies.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return companies

@router.post("/companies")
async def create_company(company_data: CompanyCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    now = datetime.now(timezone.utc)
    company = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        **company_data.dict(),
        "createdAt": now.isoformat()
    }
    
    await db.companies.insert_one(company)
    del company["_id"] if "_id" in company else None
    return company

@router.get("/companies/{company_id}")
async def get_company(company_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    company = await db.companies.find_one(
        {"id": company_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company

# Prospects
@router.get("")
async def get_prospects(
    status: Optional[str] = None,
    companyId: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=100),
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    if companyId:
        query["companyId"] = companyId
    if search:
        query["$or"] = [
            {"firstName": {"$regex": search, "$options": "i"}},
            {"lastName": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    prospects = await db.prospects.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return prospects

@router.post("")
async def create_prospect(prospect_data: ProspectCreate, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    now = datetime.now(timezone.utc)
    prospect = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        **prospect_data.dict(),
        "status": "new",
        "score": 0,
        "isVerified": False,
        "tags": [],
        "lastContactedAt": None,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.prospects.insert_one(prospect)
    del prospect["_id"] if "_id" in prospect else None
    return prospect

@router.get("/{prospect_id}")
async def get_prospect(prospect_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    prospect = await db.prospects.find_one(
        {"id": prospect_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Attach company if exists
    if prospect.get("companyId"):
        company = await db.companies.find_one(
            {"id": prospect["companyId"]},
            {"_id": 0}
        )
        prospect["company"] = company
    
    return prospect

@router.put("/{prospect_id}")
async def update_prospect(
    prospect_id: str,
    updates: dict,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    prospect = await db.prospects.find_one({"id": prospect_id, "userId": current_user["id"]})
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.prospects.update_one({"id": prospect_id}, {"$set": updates})
    
    updated = await db.prospects.find_one({"id": prospect_id}, {"_id": 0})
    return updated

@router.delete("/{prospect_id}")
async def delete_prospect(prospect_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    
    result = await db.prospects.delete_one({"id": prospect_id, "userId": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    return {"success": True, "message": "Prospect deleted"}

@router.post("/import")
async def import_prospects(
    prospects: List[ProspectCreate],
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    now = datetime.now(timezone.utc)
    created = []
    
    for p_data in prospects:
        prospect = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            **p_data.dict(),
            "status": "new",
            "score": 0,
            "isVerified": False,
            "tags": [],
            "lastContactedAt": None,
            "createdAt": now.isoformat(),
            "updatedAt": now.isoformat()
        }
        await db.prospects.insert_one(prospect)
        del prospect["_id"] if "_id" in prospect else None
        created.append(prospect)
    
    return {"imported": len(created), "prospects": created}
