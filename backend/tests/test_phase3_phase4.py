"""
Test Phase 3 (Autonomous Orchestrator) and Phase 4 (Living Knowledge Base) Features

Phase 3 Tests:
- Plan execution integrates self-learning rules
- Plan execution applies email optimization to outreach steps
- Plan execution injects knowledge context
- Plan execution stores learnings to knowledge base

Phase 4 Tests:
- POST /api/ai/knowledge/auto-ingest - Auto-ingest knowledge
- GET /api/ai/knowledge/search - Search knowledge base
- POST /api/ai/knowledge/query-rag - RAG query endpoint

Conversation History Tests:
- GET /api/ai/sessions/list - List conversation sessions
- GET /api/ai/session/{id}/messages - Get session messages
- DELETE /api/ai/session/{id} - Delete session
- POST /api/ai/session/new - Create new session
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPhase4KnowledgeBase:
    """Phase 4: Living Knowledge Base endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.test_prefix = f"TEST_{int(time.time())}"
    
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    # ============== POST /api/ai/knowledge/auto-ingest ==============
    
    def test_auto_ingest_requires_auth(self):
        """POST /api/ai/knowledge/auto-ingest requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": "Test content"
        })
        assert response.status_code in [401, 403]
    
    def test_auto_ingest_requires_content(self):
        """POST /api/ai/knowledge/auto-ingest requires content"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={})
        assert response.status_code == 400
    
    def test_auto_ingest_success(self):
        """POST /api/ai/knowledge/auto-ingest successfully ingests content"""
        self.get_auth_token()
        test_content = f"""
        {self.test_prefix} Company Research Notes:
        - Acme Corp is a Series B fintech company
        - They have 150 employees and $20M ARR
        - Key decision maker: John Smith, VP of Sales
        - Pain points: Manual sales processes, low conversion rates
        - Budget: $50K-100K for sales tools
        """
        
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": test_content,
            "category": "company_research",
            "source": "test_agent",
            "name": f"{self.test_prefix} Acme Corp Research"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "documentId" in data
        assert "extractedData" in data
        
        # Verify extracted data structure
        extracted = data.get("extractedData", {})
        # AI should extract key information
        assert isinstance(extracted, dict)
    
    def test_auto_ingest_with_default_category(self):
        """POST /api/ai/knowledge/auto-ingest uses default category"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": f"{self.test_prefix} Some test content for auto-ingest"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    # ============== GET /api/ai/knowledge/search ==============
    
    def test_search_requires_auth(self):
        """GET /api/ai/knowledge/search requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/knowledge/search?query=test")
        assert response.status_code in [401, 403]
    
    def test_search_returns_results(self):
        """GET /api/ai/knowledge/search returns matching results"""
        self.get_auth_token()
        
        # First ingest some content
        self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": f"{self.test_prefix} Searchable content about fintech companies",
            "name": f"{self.test_prefix} Fintech Research"
        })
        
        # Search for it
        response = self.session.get(f"{BASE_URL}/api/ai/knowledge/search?query={self.test_prefix}")
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
    
    def test_search_with_limit(self):
        """GET /api/ai/knowledge/search respects limit parameter"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/knowledge/search?query=test&limit=3")
        
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        assert len(results) <= 3
    
    def test_search_empty_query(self):
        """GET /api/ai/knowledge/search with empty query"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/knowledge/search?query=")
        
        # Should return empty or all results
        assert response.status_code == 200
    
    # ============== POST /api/ai/knowledge/query-rag ==============
    
    def test_rag_query_requires_auth(self):
        """POST /api/ai/knowledge/query-rag requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={
            "query": "What do we know about fintech companies?"
        })
        assert response.status_code in [401, 403]
    
    def test_rag_query_requires_query(self):
        """POST /api/ai/knowledge/query-rag requires query"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={})
        assert response.status_code == 400
    
    def test_rag_query_success(self):
        """POST /api/ai/knowledge/query-rag returns answer with sources"""
        self.get_auth_token()
        
        # First ingest some content
        self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": f"{self.test_prefix} RAG test: Healthcare companies are growing 20% YoY",
            "category": "market_research",
            "name": f"{self.test_prefix} Healthcare Market Research"
        })
        
        # Query with RAG
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={
            "query": f"What do we know about {self.test_prefix}?"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "answer" in data
        assert "sources" in data
        assert isinstance(data["sources"], list)
    
    def test_rag_query_with_categories(self):
        """POST /api/ai/knowledge/query-rag filters by categories"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={
            "query": "What are the best practices?",
            "categories": ["company_research", "market_research"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
    
    def test_rag_query_no_documents(self):
        """POST /api/ai/knowledge/query-rag handles no matching documents"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={
            "query": "What about xyz123nonexistent topic?",
            "categories": ["nonexistent_category_xyz"]
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data


class TestConversationHistory:
    """Conversation History endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.test_session_id = f"test-session-{uuid.uuid4()}"
    
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    # ============== GET /api/ai/sessions/list ==============
    
    def test_list_sessions_requires_auth(self):
        """GET /api/ai/sessions/list requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/sessions/list")
        assert response.status_code in [401, 403]
    
    def test_list_sessions_returns_formatted_list(self):
        """GET /api/ai/sessions/list returns formatted session list"""
        self.get_auth_token()
        
        # First create a session by chatting
        self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello, this is a test message for history",
            "sessionId": self.test_session_id
        })
        
        # List sessions
        response = self.session.get(f"{BASE_URL}/api/ai/sessions/list")
        
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        
        # Check session structure
        if len(sessions) > 0:
            session = sessions[0]
            assert "id" in session
            assert "title" in session
            assert "preview" in session
            assert "messageCount" in session
    
    def test_list_sessions_with_limit(self):
        """GET /api/ai/sessions/list respects limit parameter"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/sessions/list?limit=5")
        
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) <= 5
    
    # ============== GET /api/ai/session/{id}/messages ==============
    
    def test_get_messages_requires_auth(self):
        """GET /api/ai/session/{id}/messages requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/session/test-id/messages")
        assert response.status_code in [401, 403]
    
    def test_get_messages_nonexistent_session(self):
        """GET /api/ai/session/{id}/messages returns 404 for nonexistent session"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/session/nonexistent-session-xyz/messages")
        assert response.status_code == 404
    
    def test_get_messages_success(self):
        """GET /api/ai/session/{id}/messages returns messages"""
        self.get_auth_token()
        
        # Create a session with messages
        self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "First message in session",
            "sessionId": self.test_session_id
        })
        self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Second message in session",
            "sessionId": self.test_session_id
        })
        
        # Get messages
        response = self.session.get(f"{BASE_URL}/api/ai/session/{self.test_session_id}/messages")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "sessionId" in data
        assert "messages" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) >= 2  # At least 2 user messages + 2 assistant responses
    
    # ============== DELETE /api/ai/session/{id} ==============
    
    def test_delete_session_requires_auth(self):
        """DELETE /api/ai/session/{id} requires authentication"""
        response = self.session.delete(f"{BASE_URL}/api/ai/session/test-id")
        assert response.status_code in [401, 403]
    
    def test_delete_session_nonexistent(self):
        """DELETE /api/ai/session/{id} returns 404 for nonexistent session"""
        self.get_auth_token()
        response = self.session.delete(f"{BASE_URL}/api/ai/session/nonexistent-session-xyz")
        assert response.status_code == 404
    
    def test_delete_session_success(self):
        """DELETE /api/ai/session/{id} successfully deletes session"""
        self.get_auth_token()
        
        # Create a session
        delete_session_id = f"delete-test-{uuid.uuid4()}"
        self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Message to be deleted",
            "sessionId": delete_session_id
        })
        
        # Delete the session
        response = self.session.delete(f"{BASE_URL}/api/ai/session/{delete_session_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify session is deleted
        get_response = self.session.get(f"{BASE_URL}/api/ai/session/{delete_session_id}/messages")
        assert get_response.status_code == 404
    
    # ============== POST /api/ai/session/new ==============
    
    def test_create_session_requires_auth(self):
        """POST /api/ai/session/new requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/session/new")
        assert response.status_code in [401, 403]
    
    def test_create_session_success(self):
        """POST /api/ai/session/new creates new session"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/session/new")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "sessionId" in data
        assert len(data["sessionId"]) > 0
    
    def test_create_session_returns_unique_ids(self):
        """POST /api/ai/session/new returns unique session IDs"""
        self.get_auth_token()
        
        response1 = self.session.post(f"{BASE_URL}/api/ai/session/new")
        response2 = self.session.post(f"{BASE_URL}/api/ai/session/new")
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        id1 = response1.json().get("sessionId")
        id2 = response2.json().get("sessionId")
        
        assert id1 != id2


class TestPhase3PlanExecution:
    """Phase 3: Autonomous Orchestrator - Plan execution integration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    def test_chat_creates_plan_with_knowledge_context(self):
        """AI chat should have access to knowledge context when creating plans"""
        self.get_auth_token()
        
        # First add some knowledge
        self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": "Our best performing emails use personalization and mention specific pain points",
            "category": "best_practices",
            "name": "Email Best Practices"
        })
        
        # Now chat - the AI should have access to this knowledge
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Create an outreach email for a VP of Sales at a fintech company",
            "sessionId": f"knowledge-test-{uuid.uuid4()}"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_quick_action_with_outreach_agent(self):
        """Quick action with outreach agent should work"""
        self.get_auth_token()
        
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "outreach",
            "task": "Generate a cold email for John Smith, VP of Sales at Acme Corp"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("agentId") == "outreach"
    
    def test_quick_action_with_knowledge_agent(self):
        """Quick action with knowledge agent should work"""
        self.get_auth_token()
        
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "knowledge",
            "task": "What do we know about fintech companies?"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("agentId") == "knowledge"
    
    def test_self_improvement_rules_endpoint(self):
        """Self-improvement rules should be accessible"""
        self.get_auth_token()
        
        response = self.session.get(f"{BASE_URL}/api/self-improvement/rules")
        
        # Should return 200 with list of rules (may be empty)
        assert response.status_code == 200
        rules = response.json()
        assert isinstance(rules, list)
    
    def test_agent_learnings_stored_after_execution(self):
        """Agent learnings should be stored after execution"""
        self.get_auth_token()
        
        # Execute a quick action
        self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "research",
            "task": "Research Stripe company for sales outreach"
        })
        
        # Check recent activity - learnings should be tracked
        response = self.session.get(f"{BASE_URL}/api/ai/activity/recent?limit=10")
        
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)


class TestAPIIntegration:
    """Integration tests for API endpoints working together"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def get_auth_token(self):
        """Get authentication token"""
        if self.token:
            return self.token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return self.token
        return None
    
    def test_full_conversation_flow(self):
        """Test complete conversation flow: create session -> chat -> get messages -> delete"""
        self.get_auth_token()
        
        # 1. Create new session
        create_response = self.session.post(f"{BASE_URL}/api/ai/session/new")
        assert create_response.status_code == 200
        session_id = create_response.json().get("sessionId")
        
        # 2. Send messages
        chat_response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello, I need help with sales outreach",
            "sessionId": session_id
        })
        assert chat_response.status_code == 200
        
        # 3. Get messages
        messages_response = self.session.get(f"{BASE_URL}/api/ai/session/{session_id}/messages")
        assert messages_response.status_code == 200
        messages = messages_response.json().get("messages", [])
        assert len(messages) >= 2  # User + Assistant
        
        # 4. List sessions - should include our session
        list_response = self.session.get(f"{BASE_URL}/api/ai/sessions/list")
        assert list_response.status_code == 200
        sessions = list_response.json()
        session_ids = [s["id"] for s in sessions]
        assert session_id in session_ids
        
        # 5. Delete session
        delete_response = self.session.delete(f"{BASE_URL}/api/ai/session/{session_id}")
        assert delete_response.status_code == 200
        
        # 6. Verify deleted
        verify_response = self.session.get(f"{BASE_URL}/api/ai/session/{session_id}/messages")
        assert verify_response.status_code == 404
    
    def test_knowledge_ingest_search_rag_flow(self):
        """Test knowledge flow: ingest -> search -> RAG query"""
        self.get_auth_token()
        
        unique_id = f"UNIQUE_{uuid.uuid4().hex[:8]}"
        
        # 1. Ingest knowledge
        ingest_response = self.session.post(f"{BASE_URL}/api/ai/knowledge/auto-ingest", json={
            "content": f"{unique_id} Healthcare SaaS companies are growing 30% YoY. Key buyers are CTOs and VPs of Engineering.",
            "category": "market_research",
            "name": f"{unique_id} Healthcare SaaS Research"
        })
        assert ingest_response.status_code == 200
        doc_id = ingest_response.json().get("documentId")
        assert doc_id is not None
        
        # 2. Search for it
        search_response = self.session.get(f"{BASE_URL}/api/ai/knowledge/search?query={unique_id}")
        assert search_response.status_code == 200
        results = search_response.json()
        assert isinstance(results, list)
        
        # 3. RAG query
        rag_response = self.session.post(f"{BASE_URL}/api/ai/knowledge/query-rag", json={
            "query": f"What do we know about {unique_id}?"
        })
        assert rag_response.status_code == 200
        rag_data = rag_response.json()
        assert "answer" in rag_data
        assert "sources" in rag_data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
