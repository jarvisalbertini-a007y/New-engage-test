"""
Test suite for Autonomous Prospecting Module
Tests the meta-cognitive framework loops: Discovery, Research, Outreach, Learning
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestAutonomousProspectingEndpoints:
    """Test all autonomous prospecting API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    # ============== GET /api/autonomous/competitor-sources ==============
    def test_get_competitor_sources(self):
        """Test GET /api/autonomous/competitor-sources - Returns list of competitor platforms"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/competitor-sources")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 5, "Should have at least 5 competitor sources"
        
        # Verify structure of first source
        first_source = data[0]
        assert "id" in first_source, "Source should have id"
        assert "name" in first_source, "Source should have name"
        assert "domain" in first_source, "Source should have domain"
        assert "type" in first_source, "Source should have type"
        assert "learn_topics" in first_source, "Source should have learn_topics"
        
        # Verify known sources exist
        source_ids = [s["id"] for s in data]
        assert "gong" in source_ids, "Gong should be in sources"
        assert "outreach" in source_ids, "Outreach should be in sources"
        assert "apollo" in source_ids, "Apollo should be in sources"
        print(f"✓ GET /api/autonomous/competitor-sources - Found {len(data)} sources")
    
    # ============== GET /api/autonomous/status ==============
    def test_get_autonomous_status(self):
        """Test GET /api/autonomous/status - Returns current autonomous status"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "activeSession" in data, "Response should have activeSession"
        assert "recentActivity" in data, "Response should have recentActivity"
        assert "recentLearnings" in data, "Response should have recentLearnings"
        assert "isRunning" in data, "Response should have isRunning"
        
        assert isinstance(data["recentActivity"], list), "recentActivity should be a list"
        assert isinstance(data["recentLearnings"], list), "recentLearnings should be a list"
        assert isinstance(data["isRunning"], bool), "isRunning should be boolean"
        print(f"✓ GET /api/autonomous/status - isRunning: {data['isRunning']}")
    
    # ============== GET /api/autonomous/learnings ==============
    def test_get_learnings(self):
        """Test GET /api/autonomous/learnings - Returns accumulated learnings"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/learnings?limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/autonomous/learnings - Found {len(data)} learnings")
    
    # ============== POST /api/autonomous/loops/discovery ==============
    def test_discovery_loop(self):
        """Test POST /api/autonomous/loops/discovery - Runs discovery loop to find prospects"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/loops/discovery",
            json={"count": 3, "context": "B2B SaaS companies"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "loopId" in data, "Response should have loopId"
        assert "loopType" in data, "Response should have loopType"
        assert data["loopType"] == "discovery", "loopType should be 'discovery'"
        
        # Check phases are present
        if "phases" in data:
            phases = data["phases"]
            expected_phases = ["decompose", "solve", "verify", "synthesize", "reflect"]
            for phase in expected_phases:
                assert phase in phases, f"Phase '{phase}' should be in response"
                assert phases[phase]["status"] == "complete", f"Phase '{phase}' should be complete"
        
        print(f"✓ POST /api/autonomous/loops/discovery - loopId: {data.get('loopId', 'N/A')}")
        print(f"  Prospects found: {len(data.get('prospects', []))}")
    
    # ============== POST /api/autonomous/loops/research ==============
    def test_research_loop(self):
        """Test POST /api/autonomous/loops/research - Runs research loop on prospects/companies"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/loops/research",
            json={"count": 2}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "loopId" in data, "Response should have loopId"
        assert "loopType" in data, "Response should have loopType"
        assert data["loopType"] == "research", "loopType should be 'research'"
        
        print(f"✓ POST /api/autonomous/loops/research - loopId: {data.get('loopId', 'N/A')}")
        if "profiles" in data:
            print(f"  Profiles created: {len(data.get('profiles', []))}")
    
    # ============== POST /api/autonomous/loops/outreach ==============
    def test_outreach_loop(self):
        """Test POST /api/autonomous/loops/outreach - Generates personalized email drafts"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/loops/outreach",
            json={"count": 2}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "loopId" in data, "Response should have loopId"
        assert "loopType" in data, "Response should have loopType"
        assert data["loopType"] == "outreach", "loopType should be 'outreach'"
        
        print(f"✓ POST /api/autonomous/loops/outreach - loopId: {data.get('loopId', 'N/A')}")
        if "drafts" in data:
            print(f"  Drafts generated: {len(data.get('drafts', []))}")
    
    # ============== POST /api/autonomous/loops/learning ==============
    def test_learning_loop(self):
        """Test POST /api/autonomous/loops/learning - Learns from competitor platforms"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/loops/learning",
            json={}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "loopId" in data, "Response should have loopId"
        assert "loopType" in data, "Response should have loopType"
        assert data["loopType"] == "learning", "loopType should be 'learning'"
        
        # Check learning-specific fields
        if "sources_analyzed" in data:
            assert isinstance(data["sources_analyzed"], list), "sources_analyzed should be a list"
        if "techniques_learned" in data:
            assert isinstance(data["techniques_learned"], list), "techniques_learned should be a list"
        if "recommendations" in data:
            assert isinstance(data["recommendations"], (dict, list)), "recommendations should be dict or list"
        
        print(f"✓ POST /api/autonomous/loops/learning - loopId: {data.get('loopId', 'N/A')}")
        print(f"  Sources analyzed: {len(data.get('sources_analyzed', []))}")
        print(f"  Techniques learned: {len(data.get('techniques_learned', []))}")
    
    # ============== POST /api/autonomous/start ==============
    def test_start_autonomous_engine(self):
        """Test POST /api/autonomous/start - Starts full autonomous prospecting engine"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/start",
            json={
                "prospectsPerCycle": 5,
                "learningEnabled": True,
                "autoApprove": False,
                "maxCyclesPerDay": 3
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "started" in data, "Response should have 'started' field"
        assert data["started"] == True, "started should be True"
        assert "sessionId" in data, "Response should have sessionId"
        assert "config" in data, "Response should have config"
        
        # Verify config was applied
        config = data["config"]
        assert config["prospectsPerCycle"] == 5, "prospectsPerCycle should be 5"
        assert config["learningEnabled"] == True, "learningEnabled should be True"
        
        print(f"✓ POST /api/autonomous/start - sessionId: {data.get('sessionId', 'N/A')}")
        
        # Wait a moment for the engine to start
        time.sleep(1)
    
    # ============== POST /api/autonomous/stop ==============
    def test_stop_autonomous_engine(self):
        """Test POST /api/autonomous/stop - Stops the autonomous engine"""
        response = self.session.post(f"{BASE_URL}/api/autonomous/stop")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "stopped" in data, "Response should have 'stopped' field"
        assert data["stopped"] == True, "stopped should be True"
        assert "sessionsAffected" in data, "Response should have sessionsAffected"
        
        print(f"✓ POST /api/autonomous/stop - sessionsAffected: {data.get('sessionsAffected', 0)}")
    
    # ============== Verify status after stop ==============
    def test_status_after_stop(self):
        """Verify status shows not running after stop"""
        # First stop any running sessions
        self.session.post(f"{BASE_URL}/api/autonomous/stop")
        
        # Then check status
        response = self.session.get(f"{BASE_URL}/api/autonomous/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # After stopping, isRunning should be False
        assert data["isRunning"] == False, "isRunning should be False after stop"
        print(f"✓ Status after stop - isRunning: {data['isRunning']}")


class TestAutonomousProspectingAuth:
    """Test authentication requirements for autonomous endpoints"""
    
    def test_competitor_sources_no_auth_required(self):
        """Test that competitor-sources endpoint doesn't require auth"""
        response = requests.get(f"{BASE_URL}/api/autonomous/competitor-sources")
        assert response.status_code == 200, "competitor-sources should work without auth"
        print("✓ competitor-sources works without auth")
    
    def test_status_requires_auth(self):
        """Test that status endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/status")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ status endpoint requires auth")
    
    def test_loops_require_auth(self):
        """Test that loop endpoints require authentication"""
        endpoints = [
            "/api/autonomous/loops/discovery",
            "/api/autonomous/loops/research",
            "/api/autonomous/loops/outreach",
            "/api/autonomous/loops/learning"
        ]
        
        for endpoint in endpoints:
            response = requests.post(f"{BASE_URL}{endpoint}", json={})
            assert response.status_code == 401, f"{endpoint} should require auth, got {response.status_code}"
        
        print("✓ All loop endpoints require auth")
    
    def test_start_stop_require_auth(self):
        """Test that start/stop endpoints require authentication"""
        start_response = requests.post(f"{BASE_URL}/api/autonomous/start", json={})
        assert start_response.status_code == 401, "start should require auth"
        
        stop_response = requests.post(f"{BASE_URL}/api/autonomous/stop")
        assert stop_response.status_code == 401, "stop should require auth"
        
        print("✓ start/stop endpoints require auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
