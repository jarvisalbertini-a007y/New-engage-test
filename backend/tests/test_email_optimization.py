"""
Test Email Optimization & A/B Testing API Endpoints
Tests for the new AI-powered email optimization feature.
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmailOptimization:
    """Email Optimization API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    # ============== Email Optimization Tests ==============
    
    def test_optimize_email_basic(self):
        """Test POST /api/email-optimization/optimize - basic optimization"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/optimize", json={
            "subject": "Quick question about your company",
            "body": "Hi there, I noticed your company is growing. Would you be interested in learning how we help similar companies increase revenue?",
            "industry": "SaaS",
            "title": "VP Sales"
        })
        
        assert response.status_code == 200, f"Optimize failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "original" in data, "Missing 'original' in response"
        assert "optimized" in data, "Missing 'optimized' in response"
        assert "changes" in data, "Missing 'changes' in response"
        assert "predictedImprovement" in data, "Missing 'predictedImprovement'"
        assert "confidence" in data, "Missing 'confidence'"
        
        # Verify original preserved
        assert data["original"]["subject"] == "Quick question about your company"
        assert "growing" in data["original"]["body"]
        
        # Verify optimized has subject and body
        assert "subject" in data["optimized"]
        assert "body" in data["optimized"]
        
        print(f"✓ Optimization returned with {data['confidence']}% confidence")
        print(f"  Changes: {len(data.get('changes', []))} suggestions")
    
    def test_optimize_email_without_context(self):
        """Test optimization without industry/title context"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/optimize", json={
            "subject": "Partnership opportunity",
            "body": "Hello, I wanted to reach out about a potential partnership."
        })
        
        assert response.status_code == 200, f"Optimize failed: {response.text}"
        data = response.json()
        assert "optimized" in data
        print("✓ Optimization works without industry/title context")
    
    # ============== A/B Test Creation Tests ==============
    
    def test_create_ab_test_subject(self):
        """Test POST /api/email-optimization/ab-test/create - subject test"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Subject Line Test",
            "testType": "subject",
            "subject": "Quick question about {{company}}",
            "body": "Hi {{firstName}}, I noticed {{company}} is expanding. Would love to chat about how we help similar companies.",
            "variationCount": 3,
            "autoSelectWinner": True,
            "winnerCriteria": "replies"
        })
        
        assert response.status_code == 200, f"Create A/B test failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True, "Expected success=True"
        assert "testId" in data, "Missing testId"
        assert "variations" in data, "Missing variations"
        assert len(data["variations"]) == 3, f"Expected 3 variations, got {len(data['variations'])}"
        
        # Verify first variation is control
        control = data["variations"][0]
        assert control.get("isControl") == True, "First variation should be control"
        assert control.get("name") == "Control (Original)"
        
        print(f"✓ Created A/B test with {len(data['variations'])} variations")
        print(f"  Test ID: {data['testId']}")
        
        # Store for later tests
        self.test_id = data["testId"]
        return data["testId"]
    
    def test_create_ab_test_body(self):
        """Test A/B test creation with body type"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Body Variation Test",
            "testType": "body",
            "subject": "Partnership opportunity",
            "body": "Hi {{firstName}}, I wanted to reach out about a potential partnership that could benefit {{company}}.",
            "variationCount": 2
        })
        
        assert response.status_code == 200, f"Create body test failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert len(data["variations"]) == 2
        print("✓ Created body variation A/B test")
    
    def test_create_ab_test_full(self):
        """Test A/B test creation with full type"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Full Email Test",
            "testType": "full",
            "subject": "Increase your sales pipeline",
            "body": "Hi {{firstName}}, Companies like {{company}} are seeing 30% more qualified leads with our platform.",
            "variationCount": 4
        })
        
        assert response.status_code == 200, f"Create full test failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert len(data["variations"]) == 4
        print("✓ Created full email A/B test with 4 variations")
    
    # ============== A/B Test Retrieval Tests ==============
    
    def test_list_ab_tests(self):
        """Test GET /api/email-optimization/ab-tests - list all tests"""
        response = self.session.get(f"{BASE_URL}/api/email-optimization/ab-tests")
        
        assert response.status_code == 200, f"List tests failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of tests"
        print(f"✓ Listed {len(data)} A/B tests")
        
        if len(data) > 0:
            test = data[0]
            assert "id" in test, "Test missing id"
            assert "name" in test, "Test missing name"
            assert "testType" in test, "Test missing testType"
            assert "status" in test, "Test missing status"
            assert "variations" in test, "Test missing variations"
            print(f"  First test: {test['name']} ({test['status']})")
    
    def test_get_ab_test_details(self):
        """Test GET /api/email-optimization/ab-test/{id} - get test details"""
        # First create a test
        create_response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Detail Test",
            "testType": "subject",
            "subject": "Test subject",
            "body": "Test body content",
            "variationCount": 2
        })
        assert create_response.status_code == 200
        test_id = create_response.json()["testId"]
        
        # Get details
        response = self.session.get(f"{BASE_URL}/api/email-optimization/ab-test/{test_id}")
        
        assert response.status_code == 200, f"Get test details failed: {response.text}"
        data = response.json()
        
        assert data["id"] == test_id
        assert "variations" in data
        assert "results" in data, "Missing results array"
        assert "originalSubject" in data
        assert "originalBody" in data
        
        print(f"✓ Retrieved test details for {data['name']}")
        print(f"  Variations: {len(data['variations'])}, Results: {len(data['results'])}")
    
    def test_get_nonexistent_test(self):
        """Test getting a non-existent A/B test returns 404"""
        response = self.session.get(f"{BASE_URL}/api/email-optimization/ab-test/nonexistent-id-12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent test returns 404")
    
    # ============== Winner Selection Tests ==============
    
    def test_select_winner_auto(self):
        """Test POST /api/email-optimization/ab-test/{id}/select-winner - auto select"""
        # Create a test first
        create_response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Winner Selection Test",
            "testType": "subject",
            "subject": "Winner test subject",
            "body": "Winner test body",
            "variationCount": 3
        })
        assert create_response.status_code == 200
        test_id = create_response.json()["testId"]
        
        # Auto-select winner
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/{test_id}/select-winner", json={})
        
        assert response.status_code == 200, f"Select winner failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert "winnerId" in data
        assert data.get("status") == "completed"
        
        print(f"✓ Auto-selected winner: {data.get('winnerName')}")
    
    def test_select_winner_manual(self):
        """Test manual winner selection"""
        # Create a test
        create_response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Manual Winner Test",
            "testType": "subject",
            "subject": "Manual winner subject",
            "body": "Manual winner body",
            "variationCount": 2
        })
        assert create_response.status_code == 200
        test_data = create_response.json()
        test_id = test_data["testId"]
        winner_id = test_data["variations"][1]["id"]  # Select second variation
        
        # Manual select
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/{test_id}/select-winner", json={
            "winnerId": winner_id
        })
        
        assert response.status_code == 200, f"Manual select failed: {response.text}"
        data = response.json()
        assert data["winnerId"] == winner_id
        print("✓ Manually selected winner")
    
    # ============== Tracking Tests ==============
    
    def test_track_email_open(self):
        """Test POST /api/email-optimization/track/open"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/track/open", json={
            "emailId": "test-email-123",
            "draftId": "test-draft-456"
        })
        
        assert response.status_code == 200, f"Track open failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("tracked") == "open"
        print("✓ Tracked email open event")
    
    def test_track_email_click(self):
        """Test POST /api/email-optimization/track/click"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/track/click", json={
            "emailId": "test-email-123",
            "draftId": "test-draft-456",
            "linkUrl": "https://example.com/demo"
        })
        
        assert response.status_code == 200, f"Track click failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("tracked") == "click"
        print("✓ Tracked email click event")
    
    def test_track_email_reply(self):
        """Test POST /api/email-optimization/track/reply"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/track/reply", json={
            "emailId": "test-email-123",
            "draftId": "test-draft-456",
            "sentiment": "positive"
        })
        
        assert response.status_code == 200, f"Track reply failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert data.get("tracked") == "reply"
        print("✓ Tracked email reply event")
    
    def test_track_with_variation(self):
        """Test tracking with A/B test variation ID"""
        # Create a test to get variation ID
        create_response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Tracking Test",
            "testType": "subject",
            "subject": "Tracking test",
            "body": "Tracking body",
            "variationCount": 2
        })
        assert create_response.status_code == 200
        variation_id = create_response.json()["variations"][0]["id"]
        
        # Track with variation
        response = self.session.post(f"{BASE_URL}/api/email-optimization/track/open", json={
            "emailId": "test-email-var-123",
            "variationId": variation_id
        })
        
        assert response.status_code == 200
        print("✓ Tracked event with variation ID")
    
    # ============== Insights Tests ==============
    
    def test_get_insights(self):
        """Test GET /api/email-optimization/insights"""
        response = self.session.get(f"{BASE_URL}/api/email-optimization/insights")
        
        assert response.status_code == 200, f"Get insights failed: {response.text}"
        data = response.json()
        
        assert "performance" in data, "Missing performance data"
        assert "successfulPatterns" in data, "Missing successfulPatterns"
        assert "abTestLearnings" in data, "Missing abTestLearnings"
        assert "recommendations" in data, "Missing recommendations"
        
        # Verify performance structure
        perf = data["performance"]
        assert "totalSent" in perf
        assert "openRate" in perf
        assert "clickRate" in perf
        assert "replyRate" in perf
        assert "insights" in perf
        
        print(f"✓ Retrieved insights")
        print(f"  Total sent: {perf['totalSent']}, Open rate: {perf['openRate']}%")
        print(f"  Recommendations: {len(data['recommendations'])}")
    
    # ============== Auto-Optimize Draft Tests ==============
    
    def test_auto_optimize_draft_not_found(self):
        """Test auto-optimize with non-existent draft returns 404"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/auto-optimize-draft", json={
            "draftId": "nonexistent-draft-12345",
            "applyChanges": False
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Auto-optimize non-existent draft returns 404")
    
    # ============== Optimization History Tests ==============
    
    def test_get_optimization_history(self):
        """Test GET /api/email-optimization/optimization-history"""
        # First do an optimization to ensure there's history
        self.session.post(f"{BASE_URL}/api/email-optimization/optimize", json={
            "subject": "History test subject",
            "body": "History test body content"
        })
        
        response = self.session.get(f"{BASE_URL}/api/email-optimization/optimization-history?limit=10")
        
        assert response.status_code == 200, f"Get history failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Expected list of history items"
        print(f"✓ Retrieved {len(data)} optimization history items")
        
        if len(data) > 0:
            item = data[0]
            assert "id" in item
            assert "original" in item
            assert "optimized" in item
            assert "createdAt" in item
            print(f"  Latest: {item['original'].get('subject', 'N/A')[:30]}...")
    
    # ============== Edge Cases ==============
    
    def test_optimize_empty_subject(self):
        """Test optimization with empty subject"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/optimize", json={
            "subject": "",
            "body": "Some body content"
        })
        
        # Should still work, just optimize what's there
        assert response.status_code == 200
        print("✓ Handles empty subject gracefully")
    
    def test_create_test_minimum_variations(self):
        """Test creating A/B test with minimum variations"""
        response = self.session.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "TEST_Min Variations",
            "testType": "subject",
            "subject": "Min test",
            "body": "Min body",
            "variationCount": 2
        })
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["variations"]) >= 2
        print("✓ Created test with minimum variations")


class TestEmailOptimizationAuth:
    """Test authentication requirements"""
    
    def test_optimize_requires_auth(self):
        """Test that optimize endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/email-optimization/optimize", json={
            "subject": "Test",
            "body": "Test"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Optimize endpoint requires auth")
    
    def test_ab_test_requires_auth(self):
        """Test that A/B test creation requires authentication"""
        response = requests.post(f"{BASE_URL}/api/email-optimization/ab-test/create", json={
            "name": "Test",
            "testType": "subject",
            "subject": "Test",
            "body": "Test"
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ A/B test creation requires auth")
    
    def test_insights_requires_auth(self):
        """Test that insights endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/email-optimization/insights")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Insights endpoint requires auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
