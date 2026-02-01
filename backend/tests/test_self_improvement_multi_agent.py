"""
Test Suite for Self-Improvement and Multi-Agent Features (P2)

Tests:
1. Self-Improvement Engine - Learning from email performance
2. Multi-Agent Architecture - Specialized agents collaboration
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://aichat-sales-1.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestAuthentication:
    """Authentication tests to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Login successful, user: {data['user'].get('email')}")


class TestSelfImprovementStatus:
    """Test Self-Improvement Status API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_status_requires_auth(self):
        """Test that status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/self-improvement/status")
        assert response.status_code in [401, 403]
        print("Status endpoint correctly requires authentication")
    
    def test_get_status_success(self, auth_token):
        """Test getting self-improvement status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-improvement/status",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "activeRules" in data
        assert "rules" in data
        assert "recentSessions" in data
        assert "metrics" in data
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "totalEmailsAnalyzed" in metrics
        assert "patternsIdentified" in metrics
        assert "rulesGenerated" in metrics
        assert "improvementApplied" in metrics
        
        print(f"Status: {data['activeRules']} active rules, {metrics['totalEmailsAnalyzed']} emails analyzed")


class TestSelfImprovementAnalysis:
    """Test Self-Improvement Analysis API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_run_analysis_requires_auth(self):
        """Test that analysis endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/self-improvement/analyze")
        assert response.status_code in [401, 403]
        print("Analysis endpoint correctly requires authentication")
    
    def test_run_analysis_success(self, auth_token):
        """Test running performance analysis"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/self-improvement/analyze",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "sessionId" in data
        assert "summary" in data
        assert "performance" in data
        assert "patterns" in data
        assert "rules" in data
        
        # Verify summary structure
        summary = data["summary"]
        assert "emailsAnalyzed" in summary
        assert "patternsFound" in summary
        assert "rulesCreated" in summary
        
        print(f"Analysis complete: {summary['emailsAnalyzed']} emails, {summary['patternsFound']} patterns, {summary['rulesCreated']} rules")


class TestSelfImprovementRules:
    """Test Self-Improvement Rules API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_rules_requires_auth(self):
        """Test that rules endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/self-improvement/rules")
        assert response.status_code in [401, 403]
        print("Rules endpoint correctly requires authentication")
    
    def test_get_rules_success(self, auth_token):
        """Test getting improvement rules"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-improvement/rules",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # If rules exist, verify structure
        if len(data) > 0:
            rule = data[0]
            assert "id" in rule
            assert "type" in rule
            assert "rule" in rule
            assert "priority" in rule
            assert "active" in rule
            print(f"Found {len(data)} rules, first rule type: {rule['type']}")
        else:
            print("No rules found yet - run analysis first")
    
    def test_get_rules_active_only(self, auth_token):
        """Test getting only active rules"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-improvement/rules?active_only=true",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned rules should be active
        for rule in data:
            assert rule.get("active") == True
        
        print(f"Found {len(data)} active rules")


class TestSelfImprovementApplyToEmail:
    """Test Apply Learnings to Email API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_apply_requires_auth(self):
        """Test that apply endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/self-improvement/apply-to-draft",
            json={"subject": "Test", "body": "Test body"}
        )
        assert response.status_code in [401, 403]
        print("Apply endpoint correctly requires authentication")
    
    def test_apply_requires_content(self, auth_token):
        """Test that apply endpoint requires subject or body"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/self-improvement/apply-to-draft",
            headers=headers,
            json={}
        )
        assert response.status_code == 400
        print("Apply endpoint correctly requires content")
    
    def test_apply_to_email_success(self, auth_token):
        """Test applying learnings to an email"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        test_email = {
            "subject": "Quick question about your sales process",
            "body": "Hi {{firstName}},\n\nI noticed your company {{company}} is growing rapidly. I wanted to reach out about how we can help improve your sales efficiency.\n\nWould you be open to a quick call?\n\nBest,\nJohn"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/self-improvement/apply-to-draft",
            headers=headers,
            json=test_email
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "improved" in data
        assert "subject" in data["improved"]
        assert "body" in data["improved"]
        
        print(f"Email improved successfully. Changes: {data.get('changes', [])}")


class TestSelfImprovementPhrases:
    """Test Winning Phrases API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_phrases_requires_auth(self):
        """Test that phrases endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/self-improvement/phrases")
        assert response.status_code in [401, 403]
        print("Phrases endpoint correctly requires authentication")
    
    def test_get_phrases_success(self, auth_token):
        """Test getting winning phrases"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-improvement/phrases",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "phrases" in data
        
        if data["phrases"]:
            print(f"Found winning phrases: {list(data['phrases'].keys())}")
        else:
            print("No phrases learned yet - need more successful emails")


class TestSelfImprovementHistory:
    """Test Improvement History API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_history_requires_auth(self):
        """Test that history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/self-improvement/improvement-history")
        assert response.status_code in [401, 403]
        print("History endpoint correctly requires authentication")
    
    def test_get_history_success(self, auth_token):
        """Test getting improvement history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/self-improvement/improvement-history",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "improvedDrafts" in data
        assert "learningSessions" in data
        
        print(f"History: {len(data['improvedDrafts'])} improved drafts, {len(data['learningSessions'])} learning sessions")


# ============== MULTI-AGENT TESTS ==============

class TestMultiAgentTypes:
    """Test Multi-Agent Types API"""
    
    def test_get_agent_types_no_auth(self):
        """Test getting agent types (no auth required)"""
        response = requests.get(f"{BASE_URL}/api/multi-agent/types")
        assert response.status_code == 200
        data = response.json()
        
        # Should return 5 agent types
        assert isinstance(data, list)
        assert len(data) == 5
        
        # Verify agent types
        agent_ids = [a["id"] for a in data]
        expected_agents = ["research", "outreach", "optimization", "intelligence", "coordinator"]
        for expected in expected_agents:
            assert expected in agent_ids, f"Missing agent type: {expected}"
        
        # Verify structure of each agent
        for agent in data:
            assert "id" in agent
            assert "name" in agent
            assert "description" in agent
            assert "capabilities" in agent
            assert "icon" in agent
            assert "color" in agent
            assert isinstance(agent["capabilities"], list)
        
        print(f"Found {len(data)} agent types: {agent_ids}")


class TestMultiAgentExecuteSingle:
    """Test Single Agent Execution API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_execute_single_requires_auth(self):
        """Test that execute-single endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-single",
            json={"agentType": "research", "task": "Test task"}
        )
        assert response.status_code in [401, 403]
        print("Execute-single endpoint correctly requires authentication")
    
    def test_execute_single_requires_task(self, auth_token):
        """Test that execute-single requires task"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-single",
            headers=headers,
            json={"agentType": "research"}
        )
        assert response.status_code == 400
        print("Execute-single correctly requires task")
    
    def test_execute_single_invalid_agent(self, auth_token):
        """Test execute-single with invalid agent type"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-single",
            headers=headers,
            json={"agentType": "invalid_agent", "task": "Test task"}
        )
        assert response.status_code == 400
        print("Execute-single correctly rejects invalid agent type")
    
    def test_execute_single_research_agent(self, auth_token):
        """Test executing research agent"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-single",
            headers=headers,
            json={
                "agentType": "research",
                "task": "Research the fintech industry trends for 2025"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "executionId" in data
        assert "agentType" in data
        assert data["agentType"] == "research"
        assert "agentName" in data
        assert "result" in data
        
        print(f"Research agent executed successfully: {data['agentName']}")


class TestMultiAgentExecuteMulti:
    """Test Multi-Agent Task Execution API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_execute_multi_requires_auth(self):
        """Test that execute-multi endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-multi",
            json={"goal": "Test goal"}
        )
        assert response.status_code in [401, 403]
        print("Execute-multi endpoint correctly requires authentication")
    
    def test_execute_multi_requires_goal(self, auth_token):
        """Test that execute-multi requires goal"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-multi",
            headers=headers,
            json={}
        )
        assert response.status_code == 400
        print("Execute-multi correctly requires goal")
    
    def test_execute_multi_async(self, auth_token):
        """Test executing multi-agent task asynchronously"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/execute-multi",
            headers=headers,
            json={
                "goal": "Research 3 SaaS companies and generate personalized outreach emails",
                "async": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "taskId" in data
        assert "status" in data
        assert data["status"] == "pending"
        
        print(f"Multi-agent task started: {data['taskId']}")
        return data["taskId"]


class TestMultiAgentTasks:
    """Test Multi-Agent Tasks API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_list_tasks_requires_auth(self):
        """Test that tasks list endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/multi-agent/tasks")
        assert response.status_code in [401, 403]
        print("Tasks list endpoint correctly requires authentication")
    
    def test_list_tasks_success(self, auth_token):
        """Test listing multi-agent tasks"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/multi-agent/tasks",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            task = data[0]
            assert "id" in task
            assert "goal" in task
            assert "status" in task
            assert "createdAt" in task
            print(f"Found {len(data)} tasks, latest status: {task['status']}")
        else:
            print("No tasks found yet")


class TestMultiAgentTeams:
    """Test Multi-Agent Teams API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_create_team_requires_auth(self):
        """Test that team creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/team/create",
            json={"name": "Test Team", "agents": ["research"]}
        )
        assert response.status_code in [401, 403]
        print("Team creation correctly requires authentication")
    
    def test_create_team_requires_name(self, auth_token):
        """Test that team creation requires name"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/team/create",
            headers=headers,
            json={"agents": ["research"]}
        )
        assert response.status_code == 400
        print("Team creation correctly requires name")
    
    def test_create_team_requires_agents(self, auth_token):
        """Test that team creation requires agents"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/team/create",
            headers=headers,
            json={"name": "Test Team"}
        )
        assert response.status_code == 400
        print("Team creation correctly requires agents")
    
    def test_create_team_invalid_agent(self, auth_token):
        """Test team creation with invalid agent type"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/team/create",
            headers=headers,
            json={"name": "Test Team", "agents": ["invalid_agent"]}
        )
        assert response.status_code == 400
        print("Team creation correctly rejects invalid agent type")
    
    def test_create_team_success(self, auth_token):
        """Test creating a custom agent team"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        team_data = {
            "name": "TEST_Sales Research Team",
            "description": "Research and outreach team for sales",
            "agents": ["research", "outreach", "coordinator"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/team/create",
            headers=headers,
            json=team_data
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "team" in data
        
        team = data["team"]
        assert "id" in team
        assert team["name"] == team_data["name"]
        assert team["description"] == team_data["description"]
        assert team["agents"] == team_data["agents"]
        
        print(f"Team created: {team['name']} with {len(team['agents'])} agents")
        return team["id"]
    
    def test_list_teams_success(self, auth_token):
        """Test listing custom teams"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/multi-agent/teams",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            team = data[0]
            assert "id" in team
            assert "name" in team
            assert "agents" in team
            print(f"Found {len(data)} teams")
        else:
            print("No teams found")


class TestMultiAgentChat:
    """Test Multi-Agent Chat API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_chat_requires_auth(self):
        """Test that chat endpoint requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/chat",
            json={"agentType": "coordinator", "message": "Hello"}
        )
        assert response.status_code in [401, 403]
        print("Chat endpoint correctly requires authentication")
    
    def test_chat_requires_message(self, auth_token):
        """Test that chat requires message"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/chat",
            headers=headers,
            json={"agentType": "coordinator"}
        )
        assert response.status_code == 400
        print("Chat correctly requires message")
    
    def test_chat_invalid_agent(self, auth_token):
        """Test chat with invalid agent type"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/chat",
            headers=headers,
            json={"agentType": "invalid_agent", "message": "Hello"}
        )
        assert response.status_code == 400
        print("Chat correctly rejects invalid agent type")
    
    def test_chat_with_coordinator(self, auth_token):
        """Test chatting with coordinator agent"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/multi-agent/chat",
            headers=headers,
            json={
                "agentType": "coordinator",
                "message": "What agents are available and what can they do?"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "success" in data
        assert data["success"] == True
        assert "sessionId" in data
        assert "agentType" in data
        assert data["agentType"] == "coordinator"
        assert "agentName" in data
        assert "response" in data
        
        print(f"Chat with {data['agentName']} successful, session: {data['sessionId']}")


class TestMultiAgentHistory:
    """Test Multi-Agent Execution History API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_history_requires_auth(self):
        """Test that history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/multi-agent/history")
        assert response.status_code in [401, 403]
        print("History endpoint correctly requires authentication")
    
    def test_history_success(self, auth_token):
        """Test getting execution history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/multi-agent/history",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            execution = data[0]
            assert "id" in execution
            assert "agentType" in execution
            assert "task" in execution
            assert "createdAt" in execution
            print(f"Found {len(data)} executions in history")
        else:
            print("No execution history yet")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
