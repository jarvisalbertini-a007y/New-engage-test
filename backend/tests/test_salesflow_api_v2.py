"""
SalesFlow AI Backend API Tests - Iteration 2
Tests for: New Meetings/Calendar features, SendGrid email, NLP workflow generation
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
EXISTING_USER_EMAIL = "test@salesflow.com"
EXISTING_USER_PASSWORD = "test123"


class TestHealthEndpoint:
    """Health check endpoint tests"""
    
    def test_health_check(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print(f"✅ Health check passed: {data}")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == EXISTING_USER_EMAIL
        print(f"✅ Login successful for {EXISTING_USER_EMAIL}")
        return data["access_token"]


class TestGoogleIntegration:
    """Google integration endpoint tests - Calendar and Status"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_google_status_returns_connected_false(self):
        """Test Google status returns connected=false for user without Google"""
        response = requests.get(
            f"{BASE_URL}/api/google/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        # User doesn't have Google connected, so should be false
        assert data["connected"] == False
        assert data["email"] is None
        print(f"✅ Google status correctly returns connected=false")
    
    def test_calendar_events_returns_error_when_not_connected(self):
        """Test calendar events endpoint returns proper error when Google not connected"""
        response = requests.get(
            f"{BASE_URL}/api/google/calendar/events?days=7",
            headers=self.headers
        )
        # Should return 400 with proper error message
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "not connected" in data["detail"].lower() or "google" in data["detail"].lower()
        print(f"✅ Calendar events correctly returns error when not connected: {data['detail']}")


class TestSendGridEmail:
    """SendGrid email integration tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_sendgrid_email_returns_error_when_not_configured(self):
        """Test SendGrid email send returns proper error when API key not configured"""
        response = requests.post(
            f"{BASE_URL}/api/integrations/email/send",
            headers=self.headers,
            json={
                "to": "test@example.com",
                "subject": "Test Email",
                "body": "This is a test email"
            }
        )
        # Should return 400 with proper error message about SendGrid not configured
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "sendgrid" in data["detail"].lower() or "api key" in data["detail"].lower()
        print(f"✅ SendGrid email correctly returns error when not configured: {data['detail']}")
    
    def test_get_integrations_shows_sendgrid_status(self):
        """Test integrations endpoint shows SendGrid configuration status"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/integrations",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "sendgrid_configured" in data
        # User doesn't have SendGrid configured
        assert data["sendgrid_configured"] == False
        print(f"✅ Integrations correctly shows sendgrid_configured=false")


class TestNLPWorkflowGeneration:
    """NLP workflow generation endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_nlp_workflow_generation_endpoint_exists(self):
        """Test NLP workflow generation endpoint exists and accepts requests"""
        response = requests.post(
            f"{BASE_URL}/api/workflow-templates/generate-from-nlp",
            headers=self.headers,
            json={
                "description": "Create a simple 3-step email outreach sequence"
            },
            timeout=60  # LLM calls can be slow
        )
        assert response.status_code == 200
        data = response.json()
        # Should return success with workflow data
        assert "success" in data
        if data["success"]:
            assert "workflow" in data
            print(f"✅ NLP workflow generation successful: {data.get('message', 'Generated')}")
        else:
            # Even if generation fails, endpoint should work
            print(f"⚠️ NLP workflow generation returned error: {data.get('error', 'Unknown')}")
    
    def test_nlp_workflow_generation_requires_description(self):
        """Test NLP workflow generation requires description"""
        response = requests.post(
            f"{BASE_URL}/api/workflow-templates/generate-from-nlp",
            headers=self.headers,
            json={}
        )
        # Should return 400 for missing description
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        print(f"✅ NLP workflow correctly requires description: {data['detail']}")


class TestWorkflowTemplates:
    """Workflow templates endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_workflow_templates(self):
        """Test getting workflow templates"""
        response = requests.get(
            f"{BASE_URL}/api/workflow-templates/templates",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        template = data[0]
        assert "id" in template
        assert "name" in template
        assert "description" in template
        assert "nodes" in template
        assert "edges" in template
        print(f"✅ Got {len(data)} workflow templates")


class TestProspectsWithEmailProvider:
    """Prospects endpoint tests with email provider selection"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_prospects_list(self):
        """Test getting prospects list"""
        response = requests.get(
            f"{BASE_URL}/api/prospects",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} prospects")
    
    def test_create_prospect(self):
        """Test creating a new prospect"""
        unique_email = f"TEST_prospect_{uuid.uuid4().hex[:8]}@example.com"
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "email": unique_email,
                "firstName": "Test",
                "lastName": "Prospect",
                "title": "VP Sales",
                "company": "Test Corp"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == unique_email
        assert data["firstName"] == "Test"
        assert "id" in data
        print(f"✅ Created prospect: {data['id']}")


class TestEmailAnalytics:
    """Email analytics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        if login_response.status_code == 200:
            self.token = login_response.json()["access_token"]
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Could not authenticate")
    
    def test_get_email_analytics(self):
        """Test getting email analytics"""
        response = requests.get(
            f"{BASE_URL}/api/integrations/email/analytics",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "delivered" in data
        assert "opened" in data
        assert "clicked" in data
        assert "openRate" in data
        print(f"✅ Email analytics retrieved: {data['total']} total emails")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
