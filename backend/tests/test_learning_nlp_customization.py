"""
Test Suite for P1 Features: Agent Learning Visibility & NLP Agent Customization
Tests the new endpoints added in iteration 13:
- GET /api/jobs/learning/summary - learning statistics
- GET /api/jobs/agents/customization - agent settings
- POST /api/jobs/agents/customize-nlp - NLP agent customization
- GET /api/jobs/learning/history - learning history
- POST /api/jobs/learning/record - record new learning
- GET /api/jobs/learning/agent/{agent_type} - agent-specific learnings
"""

import pytest
import requests
import os
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuthSetup:
    """Authentication setup for tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestLearningSummary(TestAuthSetup):
    """Test GET /api/jobs/learning/summary endpoint"""
    
    def test_get_learning_summary_success(self, auth_headers):
        """Test getting learning summary returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/learning/summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "total" in data, "Missing 'total' field"
        assert "byAgent" in data, "Missing 'byAgent' field"
        assert "byType" in data, "Missing 'byType' field"
        assert "highImpactRecent" in data, "Missing 'highImpactRecent' field"
        
        # Verify byAgent has expected agent types
        assert isinstance(data["byAgent"], dict), "byAgent should be a dict"
        expected_agents = ["research", "outreach", "qualification", "optimization", "workflow", "orchestrator"]
        for agent in expected_agents:
            assert agent in data["byAgent"], f"Missing agent type: {agent}"
        
        # Verify byType has expected learning types
        assert isinstance(data["byType"], dict), "byType should be a dict"
        expected_types = ["observation", "success", "failure", "feedback", "optimization"]
        for lt in expected_types:
            assert lt in data["byType"], f"Missing learning type: {lt}"
        
        print(f"Learning summary: total={data['total']}, byAgent={data['byAgent']}")
    
    def test_get_learning_summary_unauthenticated(self):
        """Test that unauthenticated request fails"""
        response = requests.get(f"{BASE_URL}/api/jobs/learning/summary")
        assert response.status_code == 401 or response.status_code == 403


class TestAgentCustomization(TestAuthSetup):
    """Test GET /api/jobs/agents/customization endpoint"""
    
    def test_get_agent_customization_success(self, auth_headers):
        """Test getting agent customization returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/agents/customization",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "userId" in data, "Missing 'userId' field"
        assert "agents" in data, "Missing 'agents' field"
        assert "globalSettings" in data, "Missing 'globalSettings' field"
        
        # Verify agents structure
        assert isinstance(data["agents"], dict), "agents should be a dict"
        
        # Check for expected agent configurations
        if "research" in data["agents"]:
            research = data["agents"]["research"]
            assert "personality" in research or "depth" in research or "focusAreas" in research
        
        if "outreach" in data["agents"]:
            outreach = data["agents"]["outreach"]
            assert "personality" in outreach or "tone" in outreach or "emailLength" in outreach
        
        print(f"Agent customization: agents={list(data['agents'].keys())}")
    
    def test_update_agent_customization(self, auth_headers):
        """Test updating agent customization"""
        update_data = {
            "agents": {
                "research": {
                    "personality": "thorough",
                    "depth": "detailed"
                },
                "outreach": {
                    "tone": "friendly_professional",
                    "emailLength": "concise"
                }
            },
            "globalSettings": {
                "responseVerbosity": "balanced",
                "proactiveLevel": "moderate"
            }
        }
        
        response = requests.put(
            f"{BASE_URL}/api/jobs/agents/customization",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Update should return success=True"
        print("Agent customization updated successfully")


class TestNLPAgentCustomization(TestAuthSetup):
    """Test POST /api/jobs/agents/customize-nlp endpoint"""
    
    def test_nlp_customize_casual_tone(self, auth_headers):
        """Test NLP customization with 'casual' keyword"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "Make the outreach agent more casual and friendly",
                "agentType": "outreach"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success=True"
        assert "appliedChanges" in data, "Should return appliedChanges"
        assert "instruction" in data, "Should return original instruction"
        
        # Verify casual/friendly was parsed
        changes = data.get("appliedChanges", [])
        tone_change = next((c for c in changes if c.get("setting") == "tone"), None)
        assert tone_change is not None, "Should have parsed tone change"
        assert "casual" in tone_change.get("value", "").lower() or "friendly" in tone_change.get("value", "").lower()
        
        print(f"NLP customization applied: {len(changes)} changes")
    
    def test_nlp_customize_formal_tone(self, auth_headers):
        """Test NLP customization with 'formal' keyword"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "Make communications more formal and professional",
                "agentType": "outreach"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        changes = data.get("appliedChanges", [])
        tone_change = next((c for c in changes if c.get("setting") == "tone"), None)
        assert tone_change is not None, "Should have parsed tone change"
        assert "formal" in tone_change.get("value", "").lower() or "professional" in tone_change.get("value", "").lower()
        
        print(f"Formal tone applied: {tone_change}")
    
    def test_nlp_customize_concise(self, auth_headers):
        """Test NLP customization with 'concise' keyword"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "Make responses shorter and more concise",
                "agentType": "all"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        changes = data.get("appliedChanges", [])
        length_change = next((c for c in changes if c.get("setting") == "length"), None)
        assert length_change is not None, "Should have parsed length change"
        assert "concise" in length_change.get("value", "").lower()
        
        print(f"Concise setting applied: {length_change}")
    
    def test_nlp_customize_detailed(self, auth_headers):
        """Test NLP customization with 'detailed' keyword"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "Be more thorough and detailed in research",
                "agentType": "research"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
        changes = data.get("appliedChanges", [])
        depth_change = next((c for c in changes if c.get("setting") == "depth"), None)
        assert depth_change is not None, "Should have parsed depth change"
        assert "detailed" in depth_change.get("value", "").lower()
        
        print(f"Detailed setting applied: {depth_change}")
    
    def test_nlp_customize_empty_instruction_fails(self, auth_headers):
        """Test that empty instruction returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "",
                "agentType": "outreach"
            }
        )
        assert response.status_code == 400, f"Should fail with empty instruction: {response.text}"
    
    def test_nlp_customize_no_keywords(self, auth_headers):
        """Test NLP customization with no recognized keywords"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/agents/customize-nlp",
            headers=auth_headers,
            json={
                "instruction": "Do something random with no keywords",
                "agentType": "outreach"
            }
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        # Should still succeed but with 0 changes
        changes = data.get("appliedChanges", [])
        print(f"No keyword instruction: {len(changes)} changes applied")


class TestLearningHistory(TestAuthSetup):
    """Test learning history endpoints"""
    
    def test_get_learning_history(self, auth_headers):
        """Test getting learning history"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/learning/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        print(f"Learning history: {len(data)} entries")
    
    def test_get_learning_history_with_agent_filter(self, auth_headers):
        """Test getting learning history filtered by agent type"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/learning/history?agent_type=outreach",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        # All entries should be for outreach agent
        for entry in data:
            if "agentType" in entry:
                assert entry["agentType"] == "outreach", f"Wrong agent type: {entry['agentType']}"
        
        print(f"Outreach learning history: {len(data)} entries")
    
    def test_record_learning(self, auth_headers):
        """Test recording a new learning"""
        learning_data = {
            "agentType": "outreach",
            "learningType": "success",
            "category": "email_personalization",
            "summary": "TEST_Personalized subject lines with company name increase open rates",
            "details": {
                "metric": "open_rate",
                "improvement": "15%"
            },
            "impact": "high"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/jobs/learning/record",
            headers=auth_headers,
            json=learning_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success=True"
        assert "learningId" in data, "Should return learningId"
        
        print(f"Learning recorded: {data['learningId']}")
        return data["learningId"]
    
    def test_get_agent_learnings(self, auth_headers):
        """Test getting learnings for a specific agent"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/learning/agent/outreach",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "agentType" in data, "Should return agentType"
        assert data["agentType"] == "outreach"
        assert "totalLearnings" in data, "Should return totalLearnings"
        assert "recentLearnings" in data, "Should return recentLearnings"
        assert "categories" in data, "Should return categories"
        
        print(f"Outreach agent: {data['totalLearnings']} learnings, categories={data['categories']}")


class TestCustomizationHistory(TestAuthSetup):
    """Test customization history endpoint"""
    
    def test_get_customization_history(self, auth_headers):
        """Test getting NLP customization history"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/agents/customization-history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Should return a list"
        
        # Verify structure of history entries
        if len(data) > 0:
            entry = data[0]
            assert "instruction" in entry, "Entry should have instruction"
            assert "agentType" in entry, "Entry should have agentType"
            assert "parsedChanges" in entry, "Entry should have parsedChanges"
            assert "createdAt" in entry, "Entry should have createdAt"
        
        print(f"Customization history: {len(data)} entries")


class TestLearningFeedback(TestAuthSetup):
    """Test learning feedback endpoint"""
    
    def test_add_learning_feedback(self, auth_headers):
        """Test adding feedback to a learning"""
        # First record a learning
        learning_data = {
            "agentType": "research",
            "learningType": "observation",
            "category": "data_quality",
            "summary": "TEST_Company size data from LinkedIn is more accurate than Crunchbase",
            "impact": "medium"
        }
        
        record_response = requests.post(
            f"{BASE_URL}/api/jobs/learning/record",
            headers=auth_headers,
            json=learning_data
        )
        assert record_response.status_code == 200
        learning_id = record_response.json()["learningId"]
        
        # Add feedback
        feedback_response = requests.put(
            f"{BASE_URL}/api/jobs/learning/{learning_id}/feedback",
            headers=auth_headers,
            json={
                "feedback": "This is accurate, we should prioritize LinkedIn data",
                "rating": "thumbs_up"
            }
        )
        assert feedback_response.status_code == 200, f"Failed: {feedback_response.text}"
        
        data = feedback_response.json()
        assert data.get("success") == True
        
        print(f"Feedback added to learning {learning_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
