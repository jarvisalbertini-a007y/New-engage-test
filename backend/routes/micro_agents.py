"""Micro Agents - Specialized task executors that combine into workflows"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import asyncio

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Micro Agent Types - highly specialized, efficient tasks
MICRO_AGENT_TYPES = {
    "data_extractor": {
        "name": "Data Extractor",
        "description": "Extracts specific data points from text/documents",
        "cost": 1,  # Credit cost
        "avg_time_ms": 500
    },
    "email_scorer": {
        "name": "Email Scorer",
        "description": "Scores email quality and suggests improvements",
        "cost": 1,
        "avg_time_ms": 300
    },
    "icp_matcher": {
        "name": "ICP Matcher",
        "description": "Scores prospects against ICP criteria",
        "cost": 1,
        "avg_time_ms": 400
    },
    "sentiment_analyzer": {
        "name": "Sentiment Analyzer",
        "description": "Analyzes sentiment in communications",
        "cost": 1,
        "avg_time_ms": 200
    },
    "entity_extractor": {
        "name": "Entity Extractor",
        "description": "Extracts names, companies, titles from text",
        "cost": 1,
        "avg_time_ms": 300
    },
    "summarizer": {
        "name": "Summarizer",
        "description": "Creates concise summaries of content",
        "cost": 1,
        "avg_time_ms": 400
    },
    "intent_classifier": {
        "name": "Intent Classifier",
        "description": "Classifies intent from messages",
        "cost": 1,
        "avg_time_ms": 200
    },
    "tone_adjuster": {
        "name": "Tone Adjuster",
        "description": "Adjusts tone of content (formal/casual/urgent)",
        "cost": 1,
        "avg_time_ms": 300
    },
    "personalization_engine": {
        "name": "Personalization Engine",
        "description": "Personalizes content with prospect data",
        "cost": 2,
        "avg_time_ms": 500
    },
    "compliance_checker": {
        "name": "Compliance Checker",
        "description": "Checks content for compliance issues",
        "cost": 1,
        "avg_time_ms": 400
    },
    "signal_detector": {
        "name": "Signal Detector",
        "description": "Detects buying signals in data",
        "cost": 2,
        "avg_time_ms": 600
    },
    "response_classifier": {
        "name": "Response Classifier",
        "description": "Classifies email responses (positive/negative/neutral)",
        "cost": 1,
        "avg_time_ms": 200
    }
}

@router.get("/types")
async def get_micro_agent_types():
    """Get all available micro agent types"""
    return [
        {"id": key, **value}
        for key, value in MICRO_AGENT_TYPES.items()
    ]

@router.post("/execute")
async def execute_micro_agent(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a single micro agent task"""
    agent_type = request.get("type")
    input_data = request.get("input", {})
    model = request.get("model", "gemini-2.0-flash")  # Model selection
    
    if agent_type not in MICRO_AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown micro agent type: {agent_type}")
    
    agent_config = MICRO_AGENT_TYPES[agent_type]
    
    # Execute the micro agent
    start_time = datetime.now(timezone.utc)
    result = await run_micro_agent(agent_type, input_data, model)
    end_time = datetime.now(timezone.utc)
    
    execution_time = (end_time - start_time).total_seconds() * 1000
    
    # Log execution
    db = get_db()
    execution_log = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "agentType": agent_type,
        "model": model,
        "input": input_data,
        "output": result,
        "executionTimeMs": execution_time,
        "creditCost": agent_config["cost"],
        "createdAt": start_time.isoformat()
    }
    await db.micro_agent_executions.insert_one(execution_log)
    
    return {
        "success": True,
        "agentType": agent_type,
        "result": result,
        "executionTimeMs": execution_time,
        "creditCost": agent_config["cost"]
    }

async def run_micro_agent(agent_type: str, input_data: dict, model: str) -> dict:
    """Run a specific micro agent"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Build prompt based on agent type
        prompts = {
            "data_extractor": f"Extract the following data points from this text: {input_data.get('fields', [])}\n\nText: {input_data.get('text', '')}\n\nReturn as JSON.",
            "email_scorer": f"Score this email on a scale of 1-100 for: clarity, personalization, call-to-action, and overall effectiveness.\n\nEmail: {input_data.get('email', '')}\n\nReturn scores and brief improvement suggestions as JSON.",
            "icp_matcher": f"Score this prospect against these ICP criteria: {input_data.get('icp', {})}\n\nProspect: {input_data.get('prospect', {})}\n\nReturn match score (0-100) and reasoning as JSON.",
            "sentiment_analyzer": f"Analyze the sentiment of this message and classify as: very_positive, positive, neutral, negative, very_negative.\n\nMessage: {input_data.get('text', '')}\n\nReturn sentiment and confidence as JSON.",
            "entity_extractor": f"Extract all named entities (people, companies, titles, locations) from this text.\n\nText: {input_data.get('text', '')}\n\nReturn as JSON with entity types.",
            "summarizer": f"Summarize this content in {input_data.get('max_words', 50)} words or less.\n\nContent: {input_data.get('text', '')}\n\nReturn summary.",
            "intent_classifier": f"Classify the intent of this message. Categories: inquiry, complaint, purchase_intent, support_request, feedback, other.\n\nMessage: {input_data.get('text', '')}\n\nReturn intent and confidence as JSON.",
            "tone_adjuster": f"Rewrite this content with a {input_data.get('target_tone', 'professional')} tone.\n\nOriginal: {input_data.get('text', '')}\n\nReturn rewritten version.",
            "personalization_engine": f"Personalize this template using the prospect data.\n\nTemplate: {input_data.get('template', '')}\n\nProspect: {input_data.get('prospect', {})}\n\nReturn personalized version.",
            "compliance_checker": f"Check this content for compliance issues (spam triggers, false claims, missing disclosures).\n\nContent: {input_data.get('text', '')}\n\nReturn issues found and risk level as JSON.",
            "signal_detector": f"Analyze this data for buying signals (hiring, funding, expansion, tech changes).\n\nData: {input_data.get('data', {})}\n\nReturn detected signals with confidence scores as JSON.",
            "response_classifier": f"Classify this email response: positive (interested), negative (not interested), neutral (unclear), out_of_office, bounced.\n\nResponse: {input_data.get('text', '')}\n\nReturn classification and next_action as JSON."
        }
        
        prompt = prompts.get(agent_type, f"Process this input: {input_data}")
        
        session_id = f"micro-{agent_type[:6]}-{str(uuid4())[:6]}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=f"You are a specialized {agent_type.replace('_', ' ')} micro-agent."
        )
        response = await llm.send_message(UserMessage(text=prompt))
        
        return {"output": response, "status": "success"}
        
    except Exception as e:
        return {"output": str(e), "status": "error"}

@router.post("/chain")
async def execute_micro_agent_chain(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a chain of micro agents in sequence"""
    chain = request.get("chain", [])  # List of {type, input_mapping}
    initial_input = request.get("input", {})
    
    if not chain:
        raise HTTPException(status_code=400, detail="Chain cannot be empty")
    
    results = []
    current_data = initial_input
    total_cost = 0
    total_time = 0
    
    for step in chain:
        agent_type = step.get("type")
        input_mapping = step.get("inputMapping", {})
        
        # Map previous results to current input
        step_input = {**current_data}
        for key, source in input_mapping.items():
            if source.startswith("$prev."):
                field = source.replace("$prev.", "")
                if results:
                    step_input[key] = results[-1].get("result", {}).get(field)
        
        # Execute micro agent
        result = await execute_micro_agent(
            {"type": agent_type, "input": step_input},
            current_user
        )
        
        results.append({
            "step": len(results) + 1,
            "agentType": agent_type,
            "result": result.get("result"),
            "executionTimeMs": result.get("executionTimeMs")
        })
        
        total_cost += result.get("creditCost", 0)
        total_time += result.get("executionTimeMs", 0)
        
        # Update current data for next step
        if result.get("result", {}).get("status") == "success":
            current_data = {**current_data, "previousOutput": result.get("result", {}).get("output")}
    
    return {
        "success": True,
        "steps": results,
        "totalCreditCost": total_cost,
        "totalExecutionTimeMs": total_time,
        "finalOutput": results[-1].get("result") if results else None
    }

@router.get("/stats")
async def get_micro_agent_stats(current_user: dict = Depends(get_current_user)):
    """Get usage statistics for micro agents"""
    db = get_db()
    
    pipeline = [
        {"$match": {"userId": current_user["id"]}},
        {"$group": {
            "_id": "$agentType",
            "totalExecutions": {"$sum": 1},
            "avgExecutionTime": {"$avg": "$executionTimeMs"},
            "totalCost": {"$sum": "$creditCost"}
        }}
    ]
    
    stats = await db.micro_agent_executions.aggregate(pipeline).to_list(100)
    
    return {
        "byAgentType": stats,
        "totalExecutions": sum(s["totalExecutions"] for s in stats),
        "totalCost": sum(s["totalCost"] for s in stats)
    }
