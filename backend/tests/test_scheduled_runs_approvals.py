"""
Test suite for Scheduled Runs and Approval Workflow
Tests the new autonomous prospecting features: schedules, approvals, history
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestScheduledRuns:
    """Test scheduled runs API endpoints"""
    
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
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    # ============== POST /api/autonomous/schedule - Create scheduled run ==============
    def test_create_scheduled_run(self):
        """Test POST /api/autonomous/schedule - Creates a new scheduled run"""
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/schedule",
            json={
                "name": "TEST_Pytest Schedule",
                "scheduleType": "daily",
                "runTime": "10:00",
                "daysOfWeek": [0, 1, 2, 3, 4],
                "config": {
                    "prospectsPerCycle": 20,
                    "learningEnabled": True,
                    "autoApprove": False
                }
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "schedule" in data, "Response should have schedule object"
        
        schedule = data["schedule"]
        assert schedule["name"] == "TEST_Pytest Schedule", "Name should match"
        assert schedule["scheduleType"] == "daily", "scheduleType should be daily"
        assert schedule["runTime"] == "10:00", "runTime should be 10:00"
        assert schedule["status"] == "active", "Status should be active"
        assert "nextRunAt" in schedule, "Should have nextRunAt"
        assert "id" in schedule, "Should have id"
        
        # Store for cleanup
        self.created_schedule_id = schedule["id"]
        print(f"✓ POST /api/autonomous/schedule - Created schedule: {schedule['id']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/autonomous/schedule/{schedule['id']}")
    
    # ============== GET /api/autonomous/schedules - List all schedules ==============
    def test_get_scheduled_runs(self):
        """Test GET /api/autonomous/schedules - Returns list of scheduled runs"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/schedules")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure if schedules exist
        if len(data) > 0:
            schedule = data[0]
            assert "id" in schedule, "Schedule should have id"
            assert "name" in schedule, "Schedule should have name"
            assert "scheduleType" in schedule, "Schedule should have scheduleType"
            assert "runTime" in schedule, "Schedule should have runTime"
            assert "status" in schedule, "Schedule should have status"
            assert "nextRunAt" in schedule, "Schedule should have nextRunAt"
        
        print(f"✓ GET /api/autonomous/schedules - Found {len(data)} schedules")
    
    # ============== PUT /api/autonomous/schedule/{id} - Update schedule ==============
    def test_update_scheduled_run(self):
        """Test PUT /api/autonomous/schedule/{id} - Updates a scheduled run"""
        # First create a schedule
        create_response = self.session.post(
            f"{BASE_URL}/api/autonomous/schedule",
            json={
                "name": "TEST_Update Schedule",
                "scheduleType": "daily",
                "runTime": "08:00"
            }
        )
        schedule_id = create_response.json()["schedule"]["id"]
        
        # Update the schedule
        response = self.session.put(
            f"{BASE_URL}/api/autonomous/schedule/{schedule_id}",
            json={
                "name": "TEST_Updated Schedule Name",
                "runTime": "09:30",
                "status": "paused"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        
        print(f"✓ PUT /api/autonomous/schedule/{schedule_id} - Schedule updated")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/autonomous/schedule/{schedule_id}")
    
    # ============== DELETE /api/autonomous/schedule/{id} - Delete schedule ==============
    def test_delete_scheduled_run(self):
        """Test DELETE /api/autonomous/schedule/{id} - Deletes a scheduled run"""
        # First create a schedule
        create_response = self.session.post(
            f"{BASE_URL}/api/autonomous/schedule",
            json={
                "name": "TEST_Delete Schedule",
                "scheduleType": "daily",
                "runTime": "07:00"
            }
        )
        schedule_id = create_response.json()["schedule"]["id"]
        
        # Delete the schedule
        response = self.session.delete(f"{BASE_URL}/api/autonomous/schedule/{schedule_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("message") == "Schedule deleted", "Message should confirm deletion"
        
        # Verify it's deleted
        get_response = self.session.get(f"{BASE_URL}/api/autonomous/schedules")
        schedules = get_response.json()
        schedule_ids = [s["id"] for s in schedules]
        assert schedule_id not in schedule_ids, "Deleted schedule should not be in list"
        
        print(f"✓ DELETE /api/autonomous/schedule/{schedule_id} - Schedule deleted")
    
    # ============== POST /api/autonomous/schedule/{id}/run-now - Trigger manually ==============
    def test_run_schedule_now(self):
        """Test POST /api/autonomous/schedule/{id}/run-now - Triggers schedule manually"""
        # First create a schedule
        create_response = self.session.post(
            f"{BASE_URL}/api/autonomous/schedule",
            json={
                "name": "TEST_Run Now Schedule",
                "scheduleType": "daily",
                "runTime": "06:00"
            }
        )
        schedule_id = create_response.json()["schedule"]["id"]
        
        # Trigger run now
        response = self.session.post(f"{BASE_URL}/api/autonomous/schedule/{schedule_id}/run-now")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "sessionId" in data, "Response should have sessionId"
        
        print(f"✓ POST /api/autonomous/schedule/{schedule_id}/run-now - Triggered, sessionId: {data['sessionId']}")
        
        # Stop the session and cleanup
        self.session.post(f"{BASE_URL}/api/autonomous/stop")
        self.session.delete(f"{BASE_URL}/api/autonomous/schedule/{schedule_id}")


class TestApprovalWorkflow:
    """Test approval workflow API endpoints"""
    
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
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    # ============== GET /api/autonomous/pending-approvals ==============
    def test_get_pending_approvals(self):
        """Test GET /api/autonomous/pending-approvals - Returns email drafts pending approval"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure if drafts exist
        if len(data) > 0:
            draft = data[0]
            assert "id" in draft, "Draft should have id"
            assert "subject" in draft, "Draft should have subject"
            assert "body" in draft, "Draft should have body"
            assert "status" in draft, "Draft should have status"
            assert "qualityScore" in draft, "Draft should have qualityScore"
            
            # Check prospect enrichment
            if draft.get("prospect"):
                prospect = draft["prospect"]
                assert "firstName" in prospect or "email" in prospect, "Prospect should have basic info"
        
        print(f"✓ GET /api/autonomous/pending-approvals - Found {len(data)} drafts")
    
    # ============== POST /api/autonomous/approve/{id} - Approve ==============
    def test_approve_email_draft(self):
        """Test POST /api/autonomous/approve/{id} - Approves an email draft"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        drafts = approvals_response.json()
        
        if len(drafts) == 0:
            pytest.skip("No drafts available for approval testing")
        
        # Find a draft that's not already approved
        draft_to_approve = None
        for draft in drafts:
            if draft.get("status") in ["draft", "pending_approval"]:
                draft_to_approve = draft
                break
        
        if not draft_to_approve:
            pytest.skip("No unapproved drafts available")
        
        draft_id = draft_to_approve["id"]
        
        # Approve the draft
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/approve/{draft_id}",
            json={"action": "approve"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "approved", "Status should be approved"
        
        print(f"✓ POST /api/autonomous/approve/{draft_id} - Draft approved")
    
    # ============== POST /api/autonomous/approve/{id} - Reject ==============
    def test_reject_email_draft(self):
        """Test POST /api/autonomous/approve/{id} - Rejects an email draft"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        drafts = approvals_response.json()
        
        if len(drafts) == 0:
            pytest.skip("No drafts available for rejection testing")
        
        # Find a draft that's not already rejected
        draft_to_reject = None
        for draft in drafts:
            if draft.get("status") in ["draft", "pending_approval"]:
                draft_to_reject = draft
                break
        
        if not draft_to_reject:
            pytest.skip("No drafts available for rejection")
        
        draft_id = draft_to_reject["id"]
        
        # Reject the draft
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/approve/{draft_id}",
            json={"action": "reject", "reason": "Test rejection reason"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "rejected", "Status should be rejected"
        
        print(f"✓ POST /api/autonomous/approve/{draft_id} - Draft rejected")
    
    # ============== POST /api/autonomous/approve/{id} - Edit ==============
    def test_edit_email_draft(self):
        """Test POST /api/autonomous/approve/{id} - Edits an email draft"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        drafts = approvals_response.json()
        
        if len(drafts) == 0:
            pytest.skip("No drafts available for edit testing")
        
        # Find a draft that can be edited
        draft_to_edit = None
        for draft in drafts:
            if draft.get("status") in ["draft", "pending_approval"]:
                draft_to_edit = draft
                break
        
        if not draft_to_edit:
            pytest.skip("No drafts available for editing")
        
        draft_id = draft_to_edit["id"]
        
        # Edit the draft
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/approve/{draft_id}",
            json={
                "action": "edit",
                "editedContent": {
                    "subject": "TEST_Edited Subject Line",
                    "body": "TEST_Edited body content with more personalization."
                }
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert data.get("status") == "edited", "Status should be edited"
        
        print(f"✓ POST /api/autonomous/approve/{draft_id} - Draft edited")
    
    # ============== POST /api/autonomous/bulk-approve ==============
    def test_bulk_approve_emails(self):
        """Test POST /api/autonomous/bulk-approve - Bulk approves email drafts"""
        # Get pending approvals
        approvals_response = self.session.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        drafts = approvals_response.json()
        
        # Find drafts that can be approved
        draft_ids = []
        for draft in drafts:
            if draft.get("status") in ["draft", "pending_approval"]:
                draft_ids.append(draft["id"])
                if len(draft_ids) >= 2:
                    break
        
        if len(draft_ids) < 2:
            pytest.skip("Not enough drafts available for bulk approval testing")
        
        # Bulk approve
        response = self.session.post(
            f"{BASE_URL}/api/autonomous/bulk-approve",
            json={
                "draftIds": draft_ids,
                "action": "approve"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Response should have success=True"
        assert "approvedCount" in data, "Response should have approvedCount"
        assert "totalCount" in data, "Response should have totalCount"
        assert "results" in data, "Response should have results"
        
        print(f"✓ POST /api/autonomous/bulk-approve - Approved {data['approvedCount']}/{data['totalCount']} drafts")


class TestRunHistory:
    """Test run history API endpoint"""
    
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
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed - skipping authenticated tests")
    
    # ============== GET /api/autonomous/history ==============
    def test_get_run_history(self):
        """Test GET /api/autonomous/history - Returns history of autonomous runs"""
        response = self.session.get(f"{BASE_URL}/api/autonomous/history?limit=10")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Verify structure if history exists
        if len(data) > 0:
            run = data[0]
            assert "id" in run, "Run should have id"
            assert "status" in run, "Run should have status"
            assert "config" in run, "Run should have config"
            assert "stats" in run, "Run should have stats"
            assert "startedAt" in run, "Run should have startedAt"
            
            # Verify stats structure
            stats = run["stats"]
            assert "prospectsFound" in stats, "Stats should have prospectsFound"
            assert "emailsDrafted" in stats, "Stats should have emailsDrafted"
            assert "cyclesCompleted" in stats, "Stats should have cyclesCompleted"
        
        print(f"✓ GET /api/autonomous/history - Found {len(data)} runs")


class TestAuthRequirements:
    """Test authentication requirements for new endpoints"""
    
    def test_schedules_requires_auth(self):
        """Test that schedules endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/schedules")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ schedules endpoint requires auth")
    
    def test_pending_approvals_requires_auth(self):
        """Test that pending-approvals endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/pending-approvals")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ pending-approvals endpoint requires auth")
    
    def test_history_requires_auth(self):
        """Test that history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/autonomous/history")
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ history endpoint requires auth")
    
    def test_create_schedule_requires_auth(self):
        """Test that create schedule endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/autonomous/schedule", json={})
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ create schedule endpoint requires auth")
    
    def test_approve_requires_auth(self):
        """Test that approve endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/autonomous/approve/test-id", json={})
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ approve endpoint requires auth")
    
    def test_bulk_approve_requires_auth(self):
        """Test that bulk-approve endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/autonomous/bulk-approve", json={})
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
        print("✓ bulk-approve endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
