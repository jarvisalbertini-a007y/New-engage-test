"""Knowledge Base - RAG for file extraction and custom instructions"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List
import os
import json

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Supported file types for knowledge extraction
SUPPORTED_FILE_TYPES = {
    "text": [".txt", ".md", ".csv"],
    "document": [".pdf", ".docx"],
    "data": [".json", ".xml"]
}

@router.post("/upload")
async def upload_knowledge(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form("general"),
    description: str = Form(""),
    current_user: dict = Depends(get_current_user)
):
    """Upload a file to the knowledge base"""
    db = get_db()
    
    # Validate file type
    file_ext = os.path.splitext(file.filename)[1].lower()
    file_type = None
    for ftype, extensions in SUPPORTED_FILE_TYPES.items():
        if file_ext in extensions:
            file_type = ftype
            break
    
    if not file_type:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported: {SUPPORTED_FILE_TYPES}"
        )
    
    # Read file content
    content = await file.read()
    text_content = ""
    
    try:
        if file_type == "text":
            text_content = content.decode("utf-8")
        elif file_ext == ".json":
            data = json.loads(content.decode("utf-8"))
            text_content = json.dumps(data, indent=2)
        else:
            # For PDFs and documents, store raw and extract later
            text_content = f"[Binary content - {len(content)} bytes]"
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Extract key information using AI
    extracted_data = await extract_knowledge(text_content, category)
    
    # Store in database
    now = datetime.now(timezone.utc)
    knowledge_doc = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": name,
        "filename": file.filename,
        "fileType": file_type,
        "fileSize": len(content),
        "category": category,
        "description": description,
        "rawContent": text_content[:50000],  # Limit stored content
        "extractedData": extracted_data,
        "status": "processed",
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.knowledge_base.insert_one(knowledge_doc)
    knowledge_doc.pop("_id", None)
    
    return {
        "success": True,
        "document": knowledge_doc
    }

async def extract_knowledge(content: str, category: str) -> dict:
    """Use AI to extract structured knowledge from content"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        extraction_prompts = {
            "company_info": "Extract company information: name, industry, size, products/services, key differentiators, target customers.",
            "icp": "Extract Ideal Customer Profile details: industries, company sizes, job titles, pain points, buying triggers.",
            "competitors": "Extract competitor information: names, strengths, weaknesses, positioning.",
            "messaging": "Extract key messaging: value propositions, taglines, proof points, objection handlers.",
            "case_studies": "Extract case study details: customer name, challenge, solution, results, quotes.",
            "product": "Extract product information: features, benefits, pricing tiers, use cases.",
            "general": "Extract key information: main topics, entities, dates, numbers, and actionable insights."
        }
        
        prompt = f"""{extraction_prompts.get(category, extraction_prompts['general'])}

Content:
{content[:10000]}

Return as structured JSON."""
        
        session_id = f"kb-{str(uuid4())[:8]}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a knowledge extraction assistant."
        )
        response_text = await llm.send_message(UserMessage(text=prompt))
        
        # Try to parse JSON from response
        try:
            import re
            json_match = re.search(r'```json\s*({.*?})\s*```', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            return {"summary": response_text}
        except (json.JSONDecodeError, ValueError):
            return {"summary": response_text}
            
    except Exception as e:
        return {"error": str(e), "summary": content[:500]}

@router.get("")
async def list_knowledge(
    category: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List knowledge base documents"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    docs = await db.knowledge_base.find(
        query,
        {"_id": 0, "rawContent": 0}  # Exclude large content
    ).sort("createdAt", -1).to_list(100)
    
    return docs

@router.get("/{doc_id}")
async def get_knowledge_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific knowledge document"""
    db = get_db()
    
    doc = await db.knowledge_base.find_one(
        {"id": doc_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return doc

@router.delete("/{doc_id}")
async def delete_knowledge_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a knowledge document"""
    db = get_db()
    
    result = await db.knowledge_base.delete_one(
        {"id": doc_id, "userId": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"success": True, "message": "Document deleted"}

@router.post("/query")
async def query_knowledge(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Query knowledge base using RAG"""
    query = request.get("query", "")
    categories = request.get("categories", [])  # Optional category filter
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    db = get_db()
    
    # Find relevant documents
    doc_query = {"userId": current_user["id"]}
    if categories:
        doc_query["category"] = {"$in": categories}
    
    docs = await db.knowledge_base.find(
        doc_query,
        {"_id": 0}
    ).to_list(50)
    
    if not docs:
        return {
            "answer": "No knowledge base documents found. Upload some documents first.",
            "sources": []
        }
    
    # Build context from documents
    context_parts = []
    for doc in docs:
        content = doc.get("rawContent", "")[:5000]
        extracted = json.dumps(doc.get("extractedData", {}), indent=2)
        context_parts.append(f"Document: {doc['name']}\nCategory: {doc['category']}\nContent: {content}\nExtracted: {extracted}")
    
    context = "\n\n---\n\n".join(context_parts)
    
    # Use AI to answer based on context
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Based on the following knowledge base documents, answer this question:

Question: {query}

Knowledge Base:
{context}

Provide a comprehensive answer using information from the documents. Cite which documents you used."""
        
        session_id = f"rag-{str(uuid4())[:8]}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a knowledge base assistant. Answer questions based on the provided documents."
        )
        response_text = await llm.send_message(UserMessage(text=prompt))
        
        return {
            "answer": response_text,
            "sources": [{"id": d["id"], "name": d["name"], "category": d["category"]} for d in docs[:5]]
        }
        
    except Exception as e:
        return {
            "answer": f"Error querying knowledge base: {str(e)}",
            "sources": []
        }

# Custom Instructions Management
@router.post("/instructions")
async def create_custom_instruction(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create custom instructions for agents"""
    db = get_db()
    
    instruction = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": request.get("name", "Custom Instruction"),
        "type": request.get("type", "global"),  # global, agent-specific, workflow-specific
        "targetId": request.get("targetId"),  # Agent or workflow ID if specific
        "instruction": request.get("instruction", ""),
        "priority": request.get("priority", 0),
        "isActive": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.custom_instructions.insert_one(instruction)
    instruction.pop("_id", None)
    
    return instruction

@router.get("/instructions")
async def list_custom_instructions(
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List custom instructions"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if type:
        query["type"] = type
    
    instructions = await db.custom_instructions.find(
        query, {"_id": 0}
    ).sort("priority", -1).to_list(100)
    
    return instructions

@router.put("/instructions/{instruction_id}")
async def update_custom_instruction(
    instruction_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a custom instruction"""
    db = get_db()
    
    updates = {k: v for k, v in request.items() if k in ["name", "instruction", "priority", "isActive"]}
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_instructions.update_one(
        {"id": instruction_id, "userId": current_user["id"]},
        {"$set": updates}
    )
    
    return {"success": True, "message": "Instruction updated"}
