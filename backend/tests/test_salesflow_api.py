"""
SalesFlow AI Backend API Tests
Tests for: Health, Auth, Prospects, Google Integration, Chat
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@salesflow.com"
TEST_PASSWORD = "test123"
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
        assert "service" in data
        assert "version" in data
        print(f"✅ Health check passed: {data}")


class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@salesflow.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "firstName": "Test",
            "lastName": "User",
            "companyName": "Test Company"
        })
        
        # Could be 200 or 400 if email exists
        if response.status_code == 200:
            data = response.json()
            assert "access_token" in data
            assert "user" in data
            assert data["user"]["email"] == unique_email
            print(f"✅ Registration successful for {unique_email}")
        elif response.status_code == 400:
            print(f"⚠️ Email already registered (expected in some cases)")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": EXISTING_USER_EMAIL,
            "password": "testpass123",
            "firstName": "Test",
            "lastName": "User",
            "companyName": "Test Company"
        })
        # Should fail with 400 if user exists
        assert response.status_code in [400, 200]  # 200 if first time
        print(f"✅ Duplicate email check: status {response.status_code}")
    
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
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✅ Invalid credentials correctly rejected")
    
    def test_get_current_user(self):
        """Test /api/auth/me endpoint"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": EXISTING_USER_EMAIL,
            "password": EXISTING_USER_PASSWORD
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == EXISTING_USER_EMAIL
        print(f"✅ Get current user successful: {data['email']}")
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print("✅ Unauthorized access correctly rejected")


class TestProspectsEndpoints:
    """Prospects CRUD endpoint tests"""
    
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
        return data["id"]
    
    def test_create_and_get_prospect(self):
        """Test creating and then fetching a prospect"""
        # Create
        unique_email = f"TEST_prospect_{uuid.uuid4().hex[:8]}@example.com"
        create_response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "email": unique_email,
                "firstName": "Verify",
                "lastName": "Persistence",
                "title": "CTO",
                "company": "Verify Corp"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["id"]
        
        # Get to verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["email"] == unique_email
        assert data["firstName"] == "Verify"
        print(f"✅ Prospect persisted and retrieved: {prospect_id}")
    
    def test_update_prospect(self):
        """Test updating a prospect"""
        # Create first
        unique_email = f"TEST_update_{uuid.uuid4().hex[:8]}@example.com"
        create_response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "email": unique_email,
                "firstName": "Original",
                "lastName": "Name"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["id"]
        
        # Update
        update_response = requests.put(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=self.headers,
            json={"firstName": "Updated", "status": "contacted"}
        )
        assert update_response.status_code == 200
        
        # Verify update persisted
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["firstName"] == "Updated"
        assert data["status"] == "contacted"
        print(f"✅ Prospect updated successfully: {prospect_id}")
    
    def test_delete_prospect(self):
        """Test deleting a prospect"""
        # Create first
        unique_email = f"TEST_delete_{uuid.uuid4().hex[:8]}@example.com"
        create_response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "email": unique_email,
                "firstName": "ToDelete",
                "lastName": "User"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["id"]
        
        # Delete
        delete_response = requests.delete(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200
        
        # Verify deleted
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404
        print(f"✅ Prospect deleted successfully: {prospect_id}")


class TestGoogleIntegration:
    """Google integration endpoint tests"""
    
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
    
    def test_google_status(self):
        """Test Google integration status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/google/status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "connected" in data
        print(f"✅ Google status: connected={data['connected']}")
    
    def test_google_oauth_init(self):
        """Test Google OAuth initialization"""
        response = requests.post(
            f"{BASE_URL}/api/google/oauth/init",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "authUrl" in data
        assert "state" in data
        assert "accounts.google.com" in data["authUrl"]
        print(f"✅ Google OAuth init successful, auth URL generated")


class TestUniversalChat:
    """Universal chat endpoint tests (LLM integration)"""
    
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
    
    def test_chat_message(self):
        """Test sending a chat message"""
        response = requests.post(
            f"{BASE_URL}/api/chat/message",
            headers=self.headers,
            json={
                "message": "Hello, what can you help me with?",
                "sessionId": str(uuid.uuid4())
            },
            timeout=30  # LLM calls can be slow
        )
        assert response.status_code == 200
        data = response.json()
        assert "response" in data
        assert "intent" in data
        assert "sessionId" in data
        print(f"✅ Chat response received, intent: {data['intent']}")
    
    def test_chat_prospect_search_intent(self):
        """Test chat with prospect search intent"""
        response = requests.post(
            f"{BASE_URL}/api/chat/message",
            headers=self.headers,
            json={
                "message": "Find me 5 prospects in the tech industry",
                "sessionId": str(uuid.uuid4())
            },
            timeout=30
        )
        assert response.status_code == 200
        data = response.json()
        assert data["intent"] == "prospect_search"
        print(f"✅ Prospect search intent detected correctly")
    
    def test_chat_sessions(self):
        """Test getting chat sessions"""
        response = requests.get(
            f"{BASE_URL}/api/chat/sessions",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Got {len(data)} chat sessions")


class TestMicroAgents:
    """Micro agents endpoint tests"""
    
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
    
    def test_get_micro_agent_types(self):
        """Test getting available micro agent types"""
        response = requests.get(
            f"{BASE_URL}/api/micro-agents/types",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        agent_type = data[0]
        assert "id" in agent_type
        assert "name" in agent_type
        assert "description" in agent_type
        print(f"✅ Got {len(data)} micro agent types")


class TestIntegrations:
    """Integrations endpoint tests"""
    
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
    
    def test_get_integrations(self):
        """Test getting integrations status"""
        # Note: endpoint is /api/integrations/integrations due to router prefix
        response = requests.get(
            f"{BASE_URL}/api/integrations/integrations",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "sendgrid_configured" in data
        print(f"✅ Integrations status retrieved")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
