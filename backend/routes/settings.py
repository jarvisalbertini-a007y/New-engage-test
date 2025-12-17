"""Settings - Velocity Control, Autonomous Mode, A/B Testing"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
import os

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

# Default settings structure
DEFAULT_SETTINGS = {
    "velocity": {
        "dailyEmailLimit": 100,
        "dailyLinkedInLimit": 50,
        "simultaneousWorkflows": 5,
        "autoThrottle": True,
        "respectBusinessHours": True,
        "timezone": "America/New_York"
    },
    "autonomous": {
        "enabled": False,
        "prospectingEnabled": True,
        "autoResearch": True,
        "autoOutreach": False,
        "requireApprovalForSend": True,
        "maxProspectsPerDay": 50,
        "icpStrictness": 80
    },
    "abtest": {
        "enabled": True,
        "autoOptimize": True,
        "minSampleSize": 100,
        "confidenceThreshold": 95,
        "testSubjectLines": True,
        "testSendTimes": True,
        "testContent": True
    }
}

@router.get("")
async def get_settings(
    current_user: dict = Depends(get_current_user)
):
    """Get all user settings"""
    db = get_db()
    
    settings = await db.user_settings.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not settings:
        # Return defaults if no settings exist
        return DEFAULT_SETTINGS
    
    # Merge with defaults for any missing keys
    for section, defaults in DEFAULT_SETTINGS.items():
        if section not in settings:
            settings[section] = defaults
        else:
            for key, value in defaults.items():
                if key not in settings[section]:
                    settings[section][key] = value
    
    return settings

@router.get("/{section}")
async def get_settings_section(
    section: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific settings section"""
    if section not in DEFAULT_SETTINGS:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    
    db = get_db()
    
    settings = await db.user_settings.find_one(
        {"userId": current_user["id"]},
        {"_id": 0, section: 1}
    )
    
    if not settings or section not in settings:
        return DEFAULT_SETTINGS[section]
    
    return settings[section]

@router.put("/{section}")
async def update_settings_section(
    section: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a settings section"""
    if section not in DEFAULT_SETTINGS:
        raise HTTPException(status_code=400, detail=f"Invalid section: {section}")
    
    db = get_db()
    
    # Merge with existing settings
    update_data = {
        f"{section}": request,
        "userId": current_user["id"],
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_settings.update_one(
        {"userId": current_user["id"]},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "section": section, "updated": request}

# Autonomous mode specific endpoints
@router.get("/autonomous/status")
async def get_autonomous_status(
    current_user: dict = Depends(get_current_user)
):
    """Get autonomous mode status and activity"""
    db = get_db()
    
    settings = await db.user_settings.find_one(
        {"userId": current_user["id"]},
        {"_id": 0, "autonomous": 1}
    )
    
    enabled = settings.get("autonomous", {}).get("enabled", False) if settings else False
    
    # Get recent autonomous activity
    activity = await db.autonomous_activity.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(10).to_list(10)
    
    # Get today's stats
    today = datetime.now(timezone.utc).date().isoformat()
    stats = await db.autonomous_stats.find_one(
        {"userId": current_user["id"], "date": today},
        {"_id": 0}
    ) or {
        "prospectsFound": 0,
        "companiesResearched": 0,
        "emailsDrafted": 0,
        "pendingApprovals": 0
    }
    
    return {
        "enabled": enabled,
        "stats": stats,
        "recentActivity": activity
    }

@router.post("/autonomous/toggle")
async def toggle_autonomous_mode(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Toggle autonomous mode on/off"""
    enabled = request.get("enabled", False)
    
    db = get_db()
    
    await db.user_settings.update_one(
        {"userId": current_user["id"]},
        {"$set": {
            "autonomous.enabled": enabled,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Log the toggle event
    await db.autonomous_activity.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "type": "mode_toggle",
        "message": f"Autonomous mode {'enabled' if enabled else 'disabled'}",
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "enabled": enabled,
        "message": f"Autonomous mode {'enabled' if enabled else 'disabled'}"
    }

@router.get("/autonomous/activity")
async def get_autonomous_activity(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get autonomous mode activity log"""
    db = get_db()
    
    activity = await db.autonomous_activity.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return activity
