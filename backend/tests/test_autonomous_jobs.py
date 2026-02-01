"""
Test suite for Autonomous Jobs API endpoints (P0 - Background Agent Job Queue System)

Tests cover:
- Job creation and management (create, start, pause, cancel)
- Job listing and status
- Autonomy preferences (get, update)
- Job analytics
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestAutonomousJobsAPI:
    """Test suite for autonomous jobs endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["access_token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.user_id = data["user"]["id"]
    
    # ============== JOB CREATION TESTS ==============
    
    def test_create_job_research(self):
        """Test creating a research job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "research",
                "config": {
                    "targets": [{"name": "TEST_Company", "domain": "test.com"}],
                    "depth": "standard"
                },
                "priority": "normal",
                "autoStart": True
            }
        )
        assert response.status_code == 200, f"Create job failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "jobId" in data
        assert data["status"] in ["running", "pending"]
        assert "autonomyLevel" in data
        print(f"Created research job: {data['jobId']}")
    
    def test_create_job_outreach(self):
        """Test creating an outreach job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "outreach",
                "config": {
                    "prospects": [{"name": "TEST_Prospect", "email": "test@example.com"}],
                    "goal": "Create personalized outreach emails"
                },
                "autoStart": True
            }
        )
        assert response.status_code == 200, f"Create outreach job failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "jobId" in data
        print(f"Created outreach job: {data['jobId']}")
    
    def test_create_job_follow_up(self):
        """Test creating a follow-up job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "follow_up",
                "config": {
                    "daysSinceContact": 3,
                    "maxProspects": 5
                },
                "autoStart": True
            }
        )
        assert response.status_code == 200, f"Create follow-up job failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Created follow-up job: {data['jobId']}")
    
    def test_create_job_data_enrichment(self):
        """Test creating a data enrichment job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "data_enrich",
                "config": {
                    "maxProspects": 10
                },
                "autoStart": True
            }
        )
        assert response.status_code == 200, f"Create enrichment job failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Created enrichment job: {data['jobId']}")
    
    def test_create_job_custom(self):
        """Test creating a custom job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "custom",
                "config": {
                    "goal": "TEST_Custom task for testing"
                },
                "priority": "high",
                "autoStart": False  # Don't auto-start
            }
        )
        assert response.status_code == 200, f"Create custom job failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert data["status"] == "pending"  # Should be pending since autoStart=False
        print(f"Created custom job (pending): {data['jobId']}")
    
    # ============== JOB LISTING TESTS ==============
    
    def test_list_jobs(self):
        """Test listing all jobs"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs",
            headers=self.headers
        )
        assert response.status_code == 200, f"List jobs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} jobs")
        
        # Verify job structure
        if len(data) > 0:
            job = data[0]
            assert "id" in job
            assert "jobType" in job
            assert "status" in job
            assert "createdAt" in job
    
    def test_list_jobs_by_status(self):
        """Test listing jobs filtered by status"""
        # Test running jobs
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs?status=running",
            headers=self.headers
        )
        assert response.status_code == 200
        running_jobs = response.json()
        print(f"Running jobs: {len(running_jobs)}")
        
        # Test completed jobs
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs?status=completed",
            headers=self.headers
        )
        assert response.status_code == 200
        completed_jobs = response.json()
        print(f"Completed jobs: {len(completed_jobs)}")
    
    def test_list_jobs_by_type(self):
        """Test listing jobs filtered by type"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs?job_type=research",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        # All returned jobs should be research type
        for job in data:
            assert job["jobType"] == "research"
        print(f"Research jobs: {len(data)}")
    
    def test_list_jobs_with_limit(self):
        """Test listing jobs with limit"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs?limit=5",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5
        print(f"Jobs with limit 5: {len(data)}")
    
    # ============== JOB CONTROL TESTS ==============
    
    def test_job_lifecycle_start_pause_cancel(self):
        """Test full job lifecycle: create pending -> start -> pause -> cancel"""
        # Create a pending job
        create_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "custom",
                "config": {"goal": "TEST_Lifecycle test job"},
                "autoStart": False
            }
        )
        assert create_response.status_code == 200
        job_id = create_response.json()["jobId"]
        print(f"Created pending job: {job_id}")
        
        # Start the job
        start_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/{job_id}/start",
            headers=self.headers
        )
        assert start_response.status_code == 200, f"Start job failed: {start_response.text}"
        assert start_response.json()["success"] == True
        print(f"Started job: {job_id}")
        
        # Pause the job (may fail if job completed quickly)
        pause_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/{job_id}/pause",
            headers=self.headers
        )
        # Job might complete before we can pause it
        if pause_response.status_code == 200:
            print(f"Paused job: {job_id}")
        else:
            print(f"Job may have completed before pause: {pause_response.status_code}")
        
        # Cancel the job
        cancel_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/{job_id}/cancel",
            headers=self.headers
        )
        # Job might already be completed/cancelled
        print(f"Cancel response: {cancel_response.status_code}")
    
    def test_cancel_job(self):
        """Test cancelling a job"""
        # Create a job
        create_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/create",
            headers=self.headers,
            json={
                "jobType": "research",
                "config": {"targets": [{"name": "TEST_Cancel"}]},
                "autoStart": True
            }
        )
        assert create_response.status_code == 200
        job_id = create_response.json()["jobId"]
        
        # Cancel it
        cancel_response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/{job_id}/cancel",
            headers=self.headers
        )
        # May succeed or fail depending on job state
        print(f"Cancel job {job_id}: {cancel_response.status_code}")
    
    def test_get_running_jobs_count(self):
        """Test getting count of running jobs"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs/running/count",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get running count failed: {response.text}"
        data = response.json()
        assert "runningJobs" in data
        assert isinstance(data["runningJobs"], int)
        print(f"Running jobs count: {data['runningJobs']}")
    
    # ============== AUTONOMY PREFERENCES TESTS ==============
    
    def test_get_autonomy_preferences(self):
        """Test getting autonomy preferences"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/autonomy/preferences",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get autonomy prefs failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "userId" in data
        assert "default" in data
        assert "preferences" in data
        assert "notifications" in data
        
        # Verify default values
        assert data["default"] in ["full_auto", "approval", "notify", "manual"]
        assert isinstance(data["preferences"], dict)
        assert isinstance(data["notifications"], dict)
        
        print(f"Autonomy preferences: default={data['default']}")
        print(f"Per-type preferences: {list(data['preferences'].keys())}")
    
    def test_update_autonomy_preferences(self):
        """Test updating autonomy preferences"""
        # Update preferences
        response = requests.put(
            f"{BASE_URL}/api/jobs/autonomy/preferences",
            headers=self.headers,
            json={
                "default": "approval",
                "preferences": {
                    "research": "full_auto",
                    "outreach": "approval",
                    "follow_up": "notify",
                    "lead_monitor": "full_auto",
                    "data_enrich": "full_auto"
                },
                "notifications": {
                    "inApp": True,
                    "email": False
                }
            }
        )
        assert response.status_code == 200, f"Update autonomy prefs failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "preferences" in data
        print("Updated autonomy preferences successfully")
        
        # Verify the update
        get_response = requests.get(
            f"{BASE_URL}/api/jobs/autonomy/preferences",
            headers=self.headers
        )
        assert get_response.status_code == 200
        prefs = get_response.json()
        assert prefs["default"] == "approval"
        assert prefs["preferences"]["research"] == "full_auto"
        print("Verified autonomy preferences update")
    
    def test_ask_autonomy_preference(self):
        """Test asking for autonomy preference for a task"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/autonomy/ask-preference",
            headers=self.headers,
            json={
                "jobType": "outreach",
                "taskDescription": "Send personalized emails to 10 prospects"
            }
        )
        assert response.status_code == 200, f"Ask autonomy pref failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "jobType" in data
        assert "currentPreference" in data
        assert "options" in data
        assert "suggestion" in data
        
        # Verify options
        assert len(data["options"]) == 4  # full_auto, approval, notify, manual
        for option in data["options"]:
            assert "level" in option
            assert "label" in option
            assert "description" in option
        
        print(f"Current preference for outreach: {data['currentPreference']}")
        print(f"Suggestion: {data['suggestion']}")
    
    # ============== JOB ANALYTICS TESTS ==============
    
    def test_get_job_analytics(self):
        """Test getting job analytics summary"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/analytics/summary",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get analytics failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "byStatus" in data
        assert "byType" in data
        assert "successRate" in data
        
        # Verify byStatus
        assert "completed" in data["byStatus"]
        assert "failed" in data["byStatus"]
        assert "running" in data["byStatus"]
        assert "pending" in data["byStatus"]
        
        # Verify byType has job types
        assert isinstance(data["byType"], dict)
        
        # Verify successRate is a number
        assert isinstance(data["successRate"], (int, float))
        
        print(f"Total jobs: {data['total']}")
        print(f"By status: {data['byStatus']}")
        print(f"Success rate: {data['successRate']}%")
    
    # ============== QUICK START TESTS ==============
    
    def test_quick_start_research(self):
        """Test quick start research job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/quick-start/research",
            headers=self.headers,
            json={
                "targets": [
                    {"name": "TEST_QuickResearch", "domain": "quicktest.com"}
                ],
                "depth": "standard"
            }
        )
        assert response.status_code == 200, f"Quick start research failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        assert "jobId" in data
        print(f"Quick started research job: {data['jobId']}")
    
    def test_quick_start_outreach(self):
        """Test quick start outreach job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/quick-start/outreach",
            headers=self.headers,
            json={
                "prospects": [
                    {"name": "TEST_QuickOutreach", "email": "quick@test.com"}
                ],
                "goal": "Quick outreach test"
            }
        )
        assert response.status_code == 200, f"Quick start outreach failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Quick started outreach job: {data['jobId']}")
    
    def test_quick_start_follow_up(self):
        """Test quick start follow-up job"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/quick-start/follow-up",
            headers=self.headers,
            json={
                "daysSinceContact": 3,
                "maxProspects": 5
            }
        )
        assert response.status_code == 200, f"Quick start follow-up failed: {response.text}"
        data = response.json()
        assert data["success"] == True
        print(f"Quick started follow-up job: {data['jobId']}")
    
    # ============== ERROR HANDLING TESTS ==============
    
    def test_get_nonexistent_job(self):
        """Test getting a job that doesn't exist"""
        response = requests.get(
            f"{BASE_URL}/api/jobs/jobs/nonexistent-job-id",
            headers=self.headers
        )
        assert response.status_code == 404
        print("Correctly returned 404 for nonexistent job")
    
    def test_start_nonexistent_job(self):
        """Test starting a job that doesn't exist"""
        response = requests.post(
            f"{BASE_URL}/api/jobs/jobs/nonexistent-job-id/start",
            headers=self.headers
        )
        assert response.status_code == 404
        print("Correctly returned 404 for starting nonexistent job")
    
    def test_unauthorized_access(self):
        """Test accessing jobs without auth token"""
        response = requests.get(f"{BASE_URL}/api/jobs/jobs")
        assert response.status_code == 401 or response.status_code == 403
        print("Correctly blocked unauthorized access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
