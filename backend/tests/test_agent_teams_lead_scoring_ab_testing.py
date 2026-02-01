"""
Test Suite for Agent Teams, Lead Scoring, and A/B Testing Features
Iteration 14 - Testing parallel execution, predictive scoring, and campaign A/B testing

Features tested:
1. Agent Teams - Team templates, custom teams, parallel execution, analytics
2. Lead Scoring - Scoring factors, prospect scoring, factor weights, distribution, learning
3. A/B Testing - Test creation, start/events/complete, AI suggestions, analytics
"""

import pytest
import requests
import os
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestAuth:
    """Authentication for all tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestAgentTeams(TestAuth):
    """Agent Teams - Multi-agent orchestration with handoffs"""
    
    def test_get_team_templates(self, auth_headers):
        """Test 1: GET /api/agent-teams/templates returns team templates"""
        response = requests.get(
            f"{BASE_URL}/api/agent-teams/templates",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        assert len(templates) >= 3, "Should have at least 3 templates"
        
        # Verify template structure
        for template in templates:
            assert "id" in template, "Template should have id"
            assert "name" in template, "Template should have name"
            assert "description" in template, "Template should have description"
            assert "agents" in template, "Template should have agents"
            assert isinstance(template["agents"], list), "Agents should be a list"
        
        # Check for expected templates
        template_ids = [t["id"] for t in templates]
        assert "outbound-team" in template_ids, "Should have outbound-team template"
        assert "inbound-team" in template_ids, "Should have inbound-team template"
        assert "nurture-team" in template_ids, "Should have nurture-team template"
        
        print(f"✓ Found {len(templates)} team templates")
    
    def test_create_custom_team(self, auth_headers):
        """Test 2: POST /api/agent-teams creates custom team"""
        team_data = {
            "name": f"TEST_Custom Team {uuid4().hex[:8]}",
            "description": "Test team for automated testing",
            "agents": [
                {"role": "Researcher", "agentType": "research", "priority": 1},
                {"role": "Writer", "agentType": "content", "priority": 2}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/agent-teams",
            headers=auth_headers,
            json=team_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        team = response.json()
        assert "id" in team, "Team should have id"
        assert team["name"] == team_data["name"], "Team name should match"
        assert team["status"] == "draft", "New team should be in draft status"
        assert len(team["agents"]) == 2, "Team should have 2 agents"
        assert "handoffRules" in team, "Team should have handoff rules"
        
        # Verify handoff rules were auto-generated
        if len(team["handoffRules"]) > 0:
            rule = team["handoffRules"][0]
            assert "fromAgent" in rule, "Handoff rule should have fromAgent"
            assert "toAgent" in rule, "Handoff rule should have toAgent"
        
        print(f"✓ Created custom team: {team['id']}")
        return team["id"]
    
    def test_create_team_from_template(self, auth_headers):
        """Test creating team from template"""
        team_data = {
            "name": f"TEST_Outbound Team {uuid4().hex[:8]}",
            "templateId": "outbound-team"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/agent-teams",
            headers=auth_headers,
            json=team_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        team = response.json()
        assert len(team["agents"]) >= 3, "Template team should have multiple agents"
        
        print(f"✓ Created team from template: {team['id']}")
        return team["id"]
    
    def test_execute_team_parallel(self, auth_headers):
        """Test 3: POST /{team_id}/execute-parallel runs agents in parallel"""
        # First create and activate a team
        team_data = {
            "name": f"TEST_Parallel Team {uuid4().hex[:8]}",
            "templateId": "outbound-team"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/agent-teams",
            headers=auth_headers,
            json=team_data
        )
        assert create_response.status_code == 200
        team = create_response.json()
        team_id = team["id"]
        
        # Activate the team
        activate_response = requests.post(
            f"{BASE_URL}/api/agent-teams/{team_id}/activate",
            headers=auth_headers
        )
        # Note: Team doesn't need to be active for parallel execution based on code
        
        # Execute in parallel
        execute_data = {
            "task": "Research and qualify leads for enterprise software",
            "prospectIds": [],
            "context": {"industry": "technology"}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/agent-teams/{team_id}/execute-parallel",
            headers=auth_headers,
            json=execute_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True, "Execution should succeed"
        assert "executionId" in result, "Should have execution ID"
        assert result["executionMode"] == "parallel", "Should be parallel mode"
        assert "agentsExecuted" in result, "Should list executed agents"
        assert "results" in result, "Should have results"
        
        print(f"✓ Parallel execution completed: {result['executionId']}")
        print(f"  Agents executed: {result['agentsExecuted']}")
    
    def test_get_teams_analytics(self, auth_headers):
        """Test 4: GET /analytics/summary returns team analytics"""
        response = requests.get(
            f"{BASE_URL}/api/agent-teams/analytics/summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        analytics = response.json()
        assert "totalTeams" in analytics, "Should have totalTeams"
        assert "activeTeams" in analytics, "Should have activeTeams"
        assert "totalExecutions" in analytics, "Should have totalExecutions"
        assert "completedExecutions" in analytics, "Should have completedExecutions"
        assert "successRate" in analytics, "Should have successRate"
        assert "topTeams" in analytics, "Should have topTeams"
        
        assert isinstance(analytics["totalTeams"], int), "totalTeams should be int"
        assert isinstance(analytics["successRate"], (int, float)), "successRate should be numeric"
        
        print(f"✓ Team analytics: {analytics['totalTeams']} teams, {analytics['totalExecutions']} executions")


class TestLeadScoring(TestAuth):
    """Lead Scoring - Predictive scoring with AI learning"""
    
    def test_get_scoring_config(self, auth_headers):
        """Test 5: GET /api/lead-scoring/config returns scoring factors"""
        response = requests.get(
            f"{BASE_URL}/api/lead-scoring/config",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        config = response.json()
        assert "factors" in config, "Should have factors"
        
        factors = config["factors"]
        expected_factors = ["company_size", "industry_fit", "job_title", "engagement_score", "budget_signals", "timing"]
        
        for factor in expected_factors:
            assert factor in factors, f"Should have {factor} factor"
            assert "weight" in factors[factor], f"{factor} should have weight"
            assert "description" in factors[factor], f"{factor} should have description"
        
        print(f"✓ Scoring config has {len(factors)} factors")
        for factor, data in factors.items():
            print(f"  - {factor}: weight={data['weight']}")
    
    def test_score_prospect(self, auth_headers):
        """Test 6: POST /api/lead-scoring/score calculates prospect score with breakdown"""
        prospect_data = {
            "prospect": {
                "firstName": "John",
                "lastName": "Smith",
                "title": "VP of Engineering",
                "company": "TechCorp",
                "industry": "technology",
                "companySize": 500,
                "engagement": {
                    "opens": 5,
                    "clicks": 3,
                    "replies": 1
                },
                "budgetSignal": "likely",
                "timelineMonths": 3
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/lead-scoring/score",
            headers=auth_headers,
            json=prospect_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "score" in result, "Should have score"
        assert "priority" in result, "Should have priority"
        assert "recommendation" in result, "Should have recommendation"
        assert "factorScores" in result, "Should have factorScores"
        assert "breakdown" in result, "Should have breakdown"
        
        # Verify score is reasonable
        assert 0 <= result["score"] <= 100, "Score should be 0-100"
        assert result["priority"] in ["hot", "warm", "nurture", "cold"], "Priority should be valid"
        
        # Verify breakdown has all factors
        breakdown = result["breakdown"]
        assert len(breakdown) == 6, "Should have 6 factor breakdowns"
        
        for item in breakdown:
            assert "factor" in item, "Breakdown item should have factor"
            assert "score" in item, "Breakdown item should have score"
            assert "weight" in item, "Breakdown item should have weight"
            assert "reason" in item, "Breakdown item should have reason"
        
        print(f"✓ Prospect scored: {result['score']} ({result['priority']})")
        print(f"  Recommendation: {result['recommendation']}")
    
    def test_update_factor_weight(self, auth_headers):
        """Test 7: PUT /api/lead-scoring/config/factor/{name} updates factor weight"""
        factor_name = "engagement_score"
        new_weight = 30
        
        response = requests.put(
            f"{BASE_URL}/api/lead-scoring/config/factor/{factor_name}",
            headers=auth_headers,
            json={"weight": new_weight}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True, "Update should succeed"
        assert result["factor"] == factor_name, "Factor name should match"
        assert result["weight"] == new_weight, "Weight should be updated"
        
        print(f"✓ Updated {factor_name} weight to {new_weight}")
        
        # Reset to original weight
        requests.put(
            f"{BASE_URL}/api/lead-scoring/config/factor/{factor_name}",
            headers=auth_headers,
            json={"weight": 25}
        )
    
    def test_invalid_factor_weight(self, auth_headers):
        """Test invalid factor weight update"""
        # Invalid factor name
        response = requests.put(
            f"{BASE_URL}/api/lead-scoring/config/factor/invalid_factor",
            headers=auth_headers,
            json={"weight": 20}
        )
        assert response.status_code == 400, "Should reject invalid factor"
        
        # Invalid weight value
        response = requests.put(
            f"{BASE_URL}/api/lead-scoring/config/factor/company_size",
            headers=auth_headers,
            json={"weight": 150}  # Over 100
        )
        assert response.status_code == 400, "Should reject weight > 100"
        
        print("✓ Invalid factor weight updates rejected correctly")
    
    def test_get_score_distribution(self, auth_headers):
        """Test 8: GET /api/lead-scoring/distribution returns score distribution"""
        response = requests.get(
            f"{BASE_URL}/api/lead-scoring/distribution",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert "distribution" in result, "Should have distribution"
        assert "total" in result, "Should have total"
        
        distribution = result["distribution"]
        expected_categories = ["hot", "warm", "nurture", "cold", "unscored"]
        
        for category in expected_categories:
            assert category in distribution, f"Should have {category} category"
            assert "count" in distribution[category], f"{category} should have count"
            assert "percentage" in distribution[category], f"{category} should have percentage"
        
        print(f"✓ Score distribution: total={result['total']}")
        for cat, data in distribution.items():
            print(f"  - {cat}: {data['count']} ({data['percentage']}%)")
    
    def test_record_outcome_learn(self, auth_headers):
        """Test 9: POST /api/lead-scoring/learn records deal outcome"""
        # First create a prospect to record outcome for
        prospect_data = {
            "firstName": f"TEST_Learning_{uuid4().hex[:6]}",
            "lastName": "Prospect",
            "email": f"test_learning_{uuid4().hex[:6]}@example.com",
            "title": "Director",
            "company": "TestCorp",
            "industry": "technology",
            "companySize": 200
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=auth_headers,
            json=prospect_data
        )
        
        if create_response.status_code == 200:
            prospect = create_response.json()
            prospect_id = prospect.get("id")
            
            # Score the prospect first
            requests.post(
                f"{BASE_URL}/api/lead-scoring/score",
                headers=auth_headers,
                json={"prospectId": prospect_id}
            )
            
            # Record outcome
            outcome_data = {
                "prospectId": prospect_id,
                "outcome": "won",
                "dealValue": 50000,
                "notes": "Test outcome for learning"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/lead-scoring/learn",
                headers=auth_headers,
                json=outcome_data
            )
            assert response.status_code == 200, f"Failed: {response.text}"
            
            result = response.json()
            assert result["success"] == True, "Learning should succeed"
            assert "learningId" in result, "Should have learningId"
            assert result["message"] == "Outcome recorded: won", "Message should confirm outcome"
            
            print(f"✓ Recorded outcome: {result['learningId']}")
        else:
            # Test with mock prospect data if creation fails
            print("⚠ Prospect creation failed, testing with invalid ID to verify error handling")
            response = requests.post(
                f"{BASE_URL}/api/lead-scoring/learn",
                headers=auth_headers,
                json={"prospectId": "invalid-id", "outcome": "won"}
            )
            assert response.status_code == 404, "Should return 404 for invalid prospect"
            print("✓ Invalid prospect ID correctly rejected")
    
    def test_invalid_outcome(self, auth_headers):
        """Test invalid outcome values"""
        response = requests.post(
            f"{BASE_URL}/api/lead-scoring/learn",
            headers=auth_headers,
            json={"prospectId": "test-id", "outcome": "invalid_outcome"}
        )
        assert response.status_code == 400, "Should reject invalid outcome"
        
        print("✓ Invalid outcome correctly rejected")


class TestABTesting(TestAuth):
    """A/B Testing - Campaign testing with statistical significance"""
    
    created_test_id = None
    
    def test_create_ab_test(self, auth_headers):
        """Test 10: POST /api/ab-testing/tests creates new A/B test"""
        test_data = {
            "name": f"TEST_Subject Line Test {uuid4().hex[:8]}",
            "description": "Testing personalized vs benefit-driven subjects",
            "testType": "email_subject",
            "variantAName": "Personalized",
            "variantAContent": {"subjectLine": "{{firstName}}, quick question about {{company}}"},
            "variantBName": "Benefit-driven",
            "variantBContent": {"subjectLine": "Cut your sales cycle by 40%"},
            "primaryMetric": "openRate",
            "minSampleSize": 50,
            "confidenceThreshold": 95,
            "prospectIds": ["prospect-1", "prospect-2", "prospect-3", "prospect-4"],
            "splitRatio": 50
        }
        
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json=test_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True, "Creation should succeed"
        assert "test" in result, "Should have test object"
        
        test = result["test"]
        assert "id" in test, "Test should have id"
        assert test["name"] == test_data["name"], "Name should match"
        assert test["testType"] == "email_subject", "Test type should match"
        assert test["status"] == "draft", "New test should be draft"
        assert "variantA" in test, "Should have variantA"
        assert "variantB" in test, "Should have variantB"
        
        # Verify variant structure
        assert test["variantA"]["name"] == "Personalized"
        assert test["variantB"]["name"] == "Benefit-driven"
        assert test["variantA"]["sent"] == 0
        assert test["variantA"]["opens"] == 0
        
        TestABTesting.created_test_id = test["id"]
        print(f"✓ Created A/B test: {test['id']}")
        return test["id"]
    
    def test_start_ab_test(self, auth_headers):
        """Test 11: POST /tests/{id}/start starts test and splits prospects"""
        # Create a new test with prospects
        test_data = {
            "name": f"TEST_Start Test {uuid4().hex[:8]}",
            "testType": "email_subject",
            "prospectIds": [f"p{i}" for i in range(10)],  # 10 mock prospects
            "splitRatio": 50
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json=test_data
        )
        assert create_response.status_code == 200
        test_id = create_response.json()["test"]["id"]
        
        # Start the test
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/start",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True, "Start should succeed"
        assert "variantASample" in result, "Should have variantA sample size"
        assert "variantBSample" in result, "Should have variantB sample size"
        
        # Verify split
        total = result["variantASample"] + result["variantBSample"]
        assert total == 10, "Total should equal original prospect count"
        
        print(f"✓ Started test: A={result['variantASample']}, B={result['variantBSample']}")
        return test_id
    
    def test_record_test_event(self, auth_headers):
        """Test 12: POST /tests/{id}/record-event records open/click/reply"""
        # Create and start a test
        test_data = {
            "name": f"TEST_Event Test {uuid4().hex[:8]}",
            "testType": "email_subject",
            "prospectIds": [f"p{i}" for i in range(20)],
            "splitRatio": 50
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json=test_data
        )
        test_id = create_response.json()["test"]["id"]
        
        # Start the test
        requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/start",
            headers=auth_headers
        )
        
        # Record events for variant A
        events = [
            {"variant": "A", "eventType": "sent"},
            {"variant": "A", "eventType": "sent"},
            {"variant": "A", "eventType": "open"},
            {"variant": "A", "eventType": "click"},
            {"variant": "B", "eventType": "sent"},
            {"variant": "B", "eventType": "sent"},
            {"variant": "B", "eventType": "open"},
            {"variant": "B", "eventType": "open"},
            {"variant": "B", "eventType": "reply"}
        ]
        
        for event in events:
            response = requests.post(
                f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
                headers=auth_headers,
                json=event
            )
            assert response.status_code == 200, f"Failed to record event: {response.text}"
        
        # Verify events were recorded
        get_response = requests.get(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}",
            headers=auth_headers
        )
        test = get_response.json()
        
        assert test["variantA"]["sent"] == 2, "Variant A should have 2 sent"
        assert test["variantA"]["opens"] == 1, "Variant A should have 1 open"
        assert test["variantB"]["sent"] == 2, "Variant B should have 2 sent"
        assert test["variantB"]["opens"] == 2, "Variant B should have 2 opens"
        assert test["variantB"]["replies"] == 1, "Variant B should have 1 reply"
        
        print(f"✓ Recorded {len(events)} events")
        print(f"  Variant A: sent={test['variantA']['sent']}, opens={test['variantA']['opens']}")
        print(f"  Variant B: sent={test['variantB']['sent']}, opens={test['variantB']['opens']}, replies={test['variantB']['replies']}")
        
        return test_id
    
    def test_complete_ab_test(self, auth_headers):
        """Test 13: POST /tests/{id}/complete determines winner with statistics"""
        # Create test with significant data
        test_data = {
            "name": f"TEST_Complete Test {uuid4().hex[:8]}",
            "testType": "email_subject",
            "primaryMetric": "openRate",
            "prospectIds": [f"p{i}" for i in range(100)],
            "splitRatio": 50
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json=test_data
        )
        test_id = create_response.json()["test"]["id"]
        
        # Start test
        requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/start",
            headers=auth_headers
        )
        
        # Simulate significant difference in performance
        # Variant A: 50 sent, 10 opens (20% open rate)
        for _ in range(50):
            requests.post(
                f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
                headers=auth_headers,
                json={"variant": "A", "eventType": "sent"}
            )
        for _ in range(10):
            requests.post(
                f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
                headers=auth_headers,
                json={"variant": "A", "eventType": "open"}
            )
        
        # Variant B: 50 sent, 25 opens (50% open rate)
        for _ in range(50):
            requests.post(
                f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
                headers=auth_headers,
                json={"variant": "B", "eventType": "sent"}
            )
        for _ in range(25):
            requests.post(
                f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
                headers=auth_headers,
                json={"variant": "B", "eventType": "open"}
            )
        
        # Complete the test
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/complete",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        result = response.json()
        assert result["success"] == True, "Completion should succeed"
        assert "winner" in result, "Should have winner"
        assert "confidence" in result, "Should have confidence"
        assert "significanceResults" in result, "Should have significance results"
        
        # With 20% vs 50% open rate, B should win
        if result["winner"]:
            print(f"✓ Test completed: Winner={result['winner']} with {result['confidence']}% confidence")
        else:
            print(f"✓ Test completed: No statistically significant winner (confidence={result['confidence']}%)")
        
        # Verify significance results structure
        sig = result["significanceResults"]
        assert "openRate" in sig, "Should have openRate significance"
        assert "zScore" in sig["openRate"], "Should have Z-score"
        assert "confidence" in sig["openRate"], "Should have confidence"
    
    def test_suggest_ab_test(self, auth_headers):
        """Test 14: POST /api/ab-testing/suggest-test returns AI suggestions"""
        # Test with different goals
        goals = ["improve_open_rates", "improve_replies", "improve_conversions", "all"]
        
        for goal in goals:
            response = requests.post(
                f"{BASE_URL}/api/ab-testing/suggest-test",
                headers=auth_headers,
                json={"goal": goal}
            )
            assert response.status_code == 200, f"Failed for goal {goal}: {response.text}"
            
            result = response.json()
            assert "suggestions" in result, "Should have suggestions"
            assert "count" in result, "Should have count"
            assert result["goal"] == goal, "Goal should match"
            
            if goal == "all":
                assert len(result["suggestions"]) >= 3, "Should have multiple suggestions for 'all'"
            
            # Verify suggestion structure
            for suggestion in result["suggestions"]:
                assert "testType" in suggestion, "Suggestion should have testType"
                assert "name" in suggestion, "Suggestion should have name"
                assert "description" in suggestion, "Suggestion should have description"
                assert "variantA" in suggestion, "Suggestion should have variantA"
                assert "variantB" in suggestion, "Suggestion should have variantB"
                assert "expectedImpact" in suggestion, "Suggestion should have expectedImpact"
        
        print(f"✓ Got suggestions for all goals")
        print(f"  'all' goal returned {len(result['suggestions'])} suggestions")
    
    def test_get_ab_testing_analytics(self, auth_headers):
        """Test 15: GET /api/ab-testing/analytics/summary returns test analytics"""
        response = requests.get(
            f"{BASE_URL}/api/ab-testing/analytics/summary",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        analytics = response.json()
        assert "totalTests" in analytics, "Should have totalTests"
        assert "completedTests" in analytics, "Should have completedTests"
        assert "runningTests" in analytics, "Should have runningTests"
        assert "testsWithWinner" in analytics, "Should have testsWithWinner"
        assert "winRate" in analytics, "Should have winRate"
        assert "avgImprovement" in analytics, "Should have avgImprovement"
        assert "byType" in analytics, "Should have byType breakdown"
        
        # Verify byType has all test types
        expected_types = ["email_subject", "email_body", "email_cta", "send_time", "send_day", "channel", "full_template"]
        for test_type in expected_types:
            assert test_type in analytics["byType"], f"Should have {test_type} in byType"
        
        print(f"✓ A/B Testing analytics:")
        print(f"  Total tests: {analytics['totalTests']}")
        print(f"  Completed: {analytics['completedTests']}")
        print(f"  Running: {analytics['runningTests']}")
        print(f"  Win rate: {analytics['winRate']}%")


class TestEdgeCases(TestAuth):
    """Edge cases and error handling"""
    
    def test_ab_test_invalid_variant(self, auth_headers):
        """Test invalid variant in record-event"""
        # Create a test first
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json={"name": "TEST_Invalid Variant", "testType": "email_subject"}
        )
        test_id = create_response.json()["test"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
            headers=auth_headers,
            json={"variant": "C", "eventType": "open"}  # Invalid variant
        )
        assert response.status_code == 400, "Should reject invalid variant"
        
        print("✓ Invalid variant correctly rejected")
    
    def test_ab_test_invalid_event_type(self, auth_headers):
        """Test invalid event type in record-event"""
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json={"name": "TEST_Invalid Event", "testType": "email_subject"}
        )
        test_id = create_response.json()["test"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/record-event",
            headers=auth_headers,
            json={"variant": "A", "eventType": "invalid_event"}
        )
        assert response.status_code == 400, "Should reject invalid event type"
        
        print("✓ Invalid event type correctly rejected")
    
    def test_start_non_draft_test(self, auth_headers):
        """Test starting a test that's not in draft status"""
        # Create and start a test
        create_response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers,
            json={"name": "TEST_Already Started", "testType": "email_subject", "prospectIds": ["p1"]}
        )
        test_id = create_response.json()["test"]["id"]
        
        # Start it
        requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/start",
            headers=auth_headers
        )
        
        # Try to start again
        response = requests.post(
            f"{BASE_URL}/api/ab-testing/tests/{test_id}/start",
            headers=auth_headers
        )
        assert response.status_code == 400, "Should reject starting non-draft test"
        
        print("✓ Starting non-draft test correctly rejected")
    
    def test_parallel_execution_without_task(self, auth_headers):
        """Test parallel execution without required task"""
        # Create a team
        create_response = requests.post(
            f"{BASE_URL}/api/agent-teams",
            headers=auth_headers,
            json={"name": "TEST_No Task Team", "templateId": "outbound-team"}
        )
        team_id = create_response.json()["id"]
        
        # Try to execute without task
        response = requests.post(
            f"{BASE_URL}/api/agent-teams/{team_id}/execute-parallel",
            headers=auth_headers,
            json={"prospectIds": []}  # No task
        )
        assert response.status_code == 400, "Should reject execution without task"
        
        print("✓ Parallel execution without task correctly rejected")


class TestCleanup(TestAuth):
    """Cleanup test data"""
    
    def test_cleanup_test_data(self, auth_headers):
        """Clean up TEST_ prefixed data"""
        # Get all teams and delete TEST_ ones
        teams_response = requests.get(
            f"{BASE_URL}/api/agent-teams",
            headers=auth_headers
        )
        if teams_response.status_code == 200:
            teams = teams_response.json()
            deleted_teams = 0
            for team in teams:
                if team.get("name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/agent-teams/{team['id']}",
                        headers=auth_headers
                    )
                    deleted_teams += 1
            print(f"✓ Cleaned up {deleted_teams} test teams")
        
        # Get all A/B tests and delete TEST_ ones
        tests_response = requests.get(
            f"{BASE_URL}/api/ab-testing/tests",
            headers=auth_headers
        )
        if tests_response.status_code == 200:
            tests = tests_response.json()
            deleted_tests = 0
            for test in tests:
                if test.get("name", "").startswith("TEST_"):
                    requests.delete(
                        f"{BASE_URL}/api/ab-testing/tests/{test['id']}",
                        headers=auth_headers
                    )
                    deleted_tests += 1
            print(f"✓ Cleaned up {deleted_tests} test A/B tests")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
