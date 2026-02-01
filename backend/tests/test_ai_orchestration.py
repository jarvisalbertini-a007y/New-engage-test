"""
Test AI Orchestration Endpoints - Phase 2 (AI Command Center)

Tests the Unified Agent Framework and AI Orchestration router:
- GET /api/ai/agents - Returns 8 specialized agents
- POST /api/ai/chat - Main AI chat endpoint with plan/clarification responses
- GET /api/ai/plans/pending - Pending plans awaiting approval
- GET /api/ai/plans/active - Currently executing plans
- POST /api/ai/quick-action - Quick single-agent execution
- POST /api/ai/suggest - AI-powered suggestions
- Plan approval/rejection flow via approvePlanId/rejectPlanId
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAIOrchestration:
    """AI Orchestration endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.session_id = f"test-session-{int(time.time())}"
    
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
    
    # ============== GET /api/ai/agents ==============
    
    def test_get_agents_no_auth(self):
        """GET /api/ai/agents should work without auth (public endpoint)"""
        response = self.session.get(f"{BASE_URL}/api/ai/agents")
        assert response.status_code == 200
        agents = response.json()
        assert isinstance(agents, list)
        assert len(agents) == 8, f"Expected 8 agents, got {len(agents)}"
    
    def test_get_agents_returns_correct_structure(self):
        """GET /api/ai/agents returns agents with correct structure"""
        response = self.session.get(f"{BASE_URL}/api/ai/agents")
        assert response.status_code == 200
        agents = response.json()
        
        # Check all 8 agent types are present
        agent_ids = [a["id"] for a in agents]
        expected_ids = ["orchestrator", "research", "outreach", "optimization", 
                       "intelligence", "knowledge", "workflow", "qualification"]
        for expected_id in expected_ids:
            assert expected_id in agent_ids, f"Missing agent: {expected_id}"
        
        # Check agent structure
        for agent in agents:
            assert "id" in agent
            assert "role" in agent
            assert "name" in agent
            assert "description" in agent
            assert "capabilities" in agent
            assert isinstance(agent["capabilities"], list)
            assert "icon" in agent
            assert "color" in agent
    
    def test_orchestrator_agent_has_correct_capabilities(self):
        """Orchestrator agent should have plan_creation, task_delegation, etc."""
        response = self.session.get(f"{BASE_URL}/api/ai/agents")
        agents = response.json()
        orchestrator = next((a for a in agents if a["id"] == "orchestrator"), None)
        
        assert orchestrator is not None
        capability_names = [c["name"] for c in orchestrator["capabilities"]]
        assert "plan_creation" in capability_names
        assert "task_delegation" in capability_names
        assert "result_synthesis" in capability_names
        assert "clarification" in capability_names
    
    # ============== POST /api/ai/chat ==============
    
    def test_chat_requires_auth(self):
        """POST /api/ai/chat requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello"
        })
        assert response.status_code in [401, 403]
    
    def test_chat_requires_message(self):
        """POST /api/ai/chat requires message or plan action"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={})
        assert response.status_code == 400
    
    def test_chat_basic_message(self):
        """POST /api/ai/chat with basic message returns response"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello, what can you help me with?",
            "sessionId": self.session_id
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "sessionId" in data
        assert "response" in data
        assert "type" in data["response"]
        assert "message" in data["response"]
    
    def test_chat_returns_plan_for_complex_request(self):
        """POST /api/ai/chat with complex request may return plan"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Find 10 VPs of Sales at Series B fintech companies and create personalized outreach emails for each",
            "sessionId": self.session_id
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert "response" in data
        # Response type could be plan, clarification, or response
        assert data["response"]["type"] in ["plan", "clarification", "response", "suggestion", "execution"]
    
    def test_chat_with_session_maintains_context(self):
        """POST /api/ai/chat maintains conversation context within session"""
        self.get_auth_token()
        
        # First message
        response1 = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "I want to target healthcare companies",
            "sessionId": self.session_id
        })
        assert response1.status_code == 200
        
        # Second message in same session
        response2 = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "What size companies should I focus on?",
            "sessionId": self.session_id
        })
        assert response2.status_code == 200
        assert response2.json().get("success") == True
    
    # ============== GET /api/ai/plans/pending ==============
    
    def test_pending_plans_requires_auth(self):
        """GET /api/ai/plans/pending requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/plans/pending")
        assert response.status_code == 401
    
    def test_pending_plans_returns_list(self):
        """GET /api/ai/plans/pending returns list of pending plans"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/plans/pending")
        assert response.status_code == 200
        plans = response.json()
        assert isinstance(plans, list)
    
    # ============== GET /api/ai/plans/active ==============
    
    def test_active_plans_requires_auth(self):
        """GET /api/ai/plans/active requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/plans/active")
        assert response.status_code == 401
    
    def test_active_plans_returns_list(self):
        """GET /api/ai/plans/active returns list of executing plans"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/plans/active")
        assert response.status_code == 200
        plans = response.json()
        assert isinstance(plans, list)
    
    # ============== POST /api/ai/quick-action ==============
    
    def test_quick_action_requires_auth(self):
        """POST /api/ai/quick-action requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "research",
            "task": "Research Acme Corp"
        })
        assert response.status_code == 401
    
    def test_quick_action_requires_task(self):
        """POST /api/ai/quick-action requires task"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "research"
        })
        assert response.status_code == 400
    
    def test_quick_action_with_research_agent(self):
        """POST /api/ai/quick-action executes task with research agent"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "research",
            "task": "Research Stripe company"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("agentId") == "research"
        assert "result" in data
    
    def test_quick_action_with_qualification_agent(self):
        """POST /api/ai/quick-action executes task with qualification agent"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "qualification",
            "task": "Score this lead: VP of Sales at a 50-person SaaS company with $10M ARR"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("agentId") == "qualification"
    
    def test_quick_action_with_invalid_agent_falls_back(self):
        """POST /api/ai/quick-action with invalid agent falls back to orchestrator"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/quick-action", json={
            "agentId": "invalid_agent",
            "task": "Do something"
        })
        # Should still work, falling back to orchestrator
        assert response.status_code == 200
    
    # ============== POST /api/ai/suggest ==============
    
    def test_suggest_requires_auth(self):
        """POST /api/ai/suggest requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/ai/suggest", json={
            "context": "general"
        })
        assert response.status_code == 401
    
    def test_suggest_returns_suggestions(self):
        """POST /api/ai/suggest returns list of suggestions"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/suggest", json={
            "context": "general"
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        assert len(data["suggestions"]) > 0
        
        # Check suggestion structure
        for suggestion in data["suggestions"]:
            assert "text" in suggestion
            assert "action" in suggestion
    
    def test_suggest_with_prospect_context(self):
        """POST /api/ai/suggest with prospect context"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/suggest", json={
            "context": "prospect"
        })
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
    
    def test_suggest_with_workflow_context(self):
        """POST /api/ai/suggest with workflow context"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/suggest", json={
            "context": "workflow"
        })
        assert response.status_code == 200
        data = response.json()
        assert "suggestions" in data
    
    # ============== Plan Approval/Rejection Flow ==============
    
    def test_approve_nonexistent_plan(self):
        """POST /api/ai/chat with approvePlanId for nonexistent plan returns 404"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "approvePlanId": "nonexistent-plan-id-12345"
        })
        assert response.status_code == 404
    
    def test_reject_nonexistent_plan(self):
        """POST /api/ai/chat with rejectPlanId for nonexistent plan returns 404"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "rejectPlanId": "nonexistent-plan-id-12345"
        })
        assert response.status_code == 404
    
    # ============== GET /api/ai/session/{session_id} ==============
    
    def test_get_session_requires_auth(self):
        """GET /api/ai/session/{id} requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/session/test-session")
        assert response.status_code == 401
    
    def test_get_nonexistent_session(self):
        """GET /api/ai/session/{id} for nonexistent session returns 404"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/session/nonexistent-session-12345")
        assert response.status_code == 404
    
    def test_get_session_after_chat(self):
        """GET /api/ai/session/{id} returns session after chat"""
        self.get_auth_token()
        
        # Create a session by chatting
        chat_response = self.session.post(f"{BASE_URL}/api/ai/chat", json={
            "message": "Hello",
            "sessionId": self.session_id
        })
        assert chat_response.status_code == 200
        
        # Get the session
        response = self.session.get(f"{BASE_URL}/api/ai/session/{self.session_id}")
        assert response.status_code == 200
        session = response.json()
        
        assert "messages" in session
        assert isinstance(session["messages"], list)
    
    # ============== GET /api/ai/sessions ==============
    
    def test_get_sessions_requires_auth(self):
        """GET /api/ai/sessions requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/sessions")
        assert response.status_code == 401
    
    def test_get_sessions_returns_list(self):
        """GET /api/ai/sessions returns list of user sessions"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
    
    # ============== GET /api/ai/activity/recent ==============
    
    def test_recent_activity_requires_auth(self):
        """GET /api/ai/activity/recent requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/ai/activity/recent")
        assert response.status_code == 401
    
    def test_recent_activity_returns_list(self):
        """GET /api/ai/activity/recent returns list of activities"""
        self.get_auth_token()
        response = self.session.get(f"{BASE_URL}/api/ai/activity/recent")
        assert response.status_code == 200
        activities = response.json()
        assert isinstance(activities, list)
    
    # ============== Plan Pause/Resume ==============
    
    def test_pause_nonexistent_plan(self):
        """POST /api/ai/plan/{id}/pause for nonexistent plan returns 404"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/plan/nonexistent-plan/pause")
        assert response.status_code == 404
    
    def test_resume_nonexistent_plan(self):
        """POST /api/ai/plan/{id}/resume for nonexistent plan returns 404"""
        self.get_auth_token()
        response = self.session.post(f"{BASE_URL}/api/ai/plan/nonexistent-plan/resume")
        assert response.status_code == 404


class TestUnifiedAgentFramework:
    """Tests for the Unified Agent Framework structure"""
    
    def test_all_8_agents_present(self):
        """Verify all 8 agent types are registered"""
        response = requests.get(f"{BASE_URL}/api/ai/agents")
        assert response.status_code == 200
        agents = response.json()
        
        expected_roles = {
            "orchestrator": "Orchestrator",
            "research": "Research Agent",
            "outreach": "Outreach Agent",
            "optimization": "Optimization Agent",
            "intelligence": "Intelligence Agent",
            "knowledge": "Knowledge Agent",
            "workflow": "Workflow Agent",
            "qualification": "Qualification Agent"
        }
        
        for agent_id, expected_name in expected_roles.items():
            agent = next((a for a in agents if a["id"] == agent_id), None)
            assert agent is not None, f"Missing agent: {agent_id}"
            assert agent["name"] == expected_name, f"Wrong name for {agent_id}"
    
    def test_agents_have_capabilities(self):
        """Each agent should have at least one capability"""
        response = requests.get(f"{BASE_URL}/api/ai/agents")
        agents = response.json()
        
        for agent in agents:
            assert len(agent["capabilities"]) > 0, f"Agent {agent['id']} has no capabilities"
    
    def test_outreach_agent_requires_approval(self):
        """Outreach agent's email_generation should require approval"""
        response = requests.get(f"{BASE_URL}/api/ai/agents")
        agents = response.json()
        
        outreach = next((a for a in agents if a["id"] == "outreach"), None)
        assert outreach is not None
        
        email_gen = next((c for c in outreach["capabilities"] if c["name"] == "email_generation"), None)
        assert email_gen is not None
        assert email_gen["requiresApproval"] == True
    
    def test_workflow_agent_requires_approval(self):
        """Workflow agent's workflow_creation should require approval"""
        response = requests.get(f"{BASE_URL}/api/ai/agents")
        agents = response.json()
        
        workflow = next((a for a in agents if a["id"] == "workflow"), None)
        assert workflow is not None
        
        workflow_creation = next((c for c in workflow["capabilities"] if c["name"] == "workflow_creation"), None)
        assert workflow_creation is not None
        assert workflow_creation["requiresApproval"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
