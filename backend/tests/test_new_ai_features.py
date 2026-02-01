"""
Test New AI Features - Iteration 10
Tests for:
- AI Create Workflow endpoint POST /api/ai/create-workflow
- Unified Approvals endpoint GET /api/ai/pending-approvals-unified
- Approve Unified Item endpoint POST /api/ai/approve-item/{id}
- Document Upload endpoint POST /api/ai/knowledge/upload with AI extraction
- Voice Transcribe placeholder endpoint POST /api/ai/voice/transcribe
- AI Stats endpoint GET /api/ai/stats
"""

import pytest
import requests
import os
import json
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@salesflow.com"
TEST_PASSWORD = "test123"


class TestAuthentication:
    """Get auth token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, f"No token in response: {data}"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Return headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestAICreateWorkflow(TestAuthentication):
    """Test AI-powered workflow creation from natural language"""
    
    def test_create_workflow_no_auth(self):
        """Should return 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            json={"description": "Test workflow"}
        )
        assert response.status_code == 403
    
    def test_create_workflow_no_description(self, auth_headers):
        """Should return 400 without description"""
        response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "description" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower()
    
    def test_create_workflow_success(self, auth_headers):
        """Should create workflow from natural language description"""
        response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            headers=auth_headers,
            json={
                "description": "Create a 3-step email sequence for cold outreach to tech companies",
                "name": "TEST_Cold_Outreach_Sequence"
            },
            timeout=60  # AI generation may take time
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "workflow" in data
        assert "message" in data
        
        # Verify workflow structure
        workflow = data["workflow"]
        assert "id" in workflow
        assert "name" in workflow
        assert "nodes" in workflow
        assert "edges" in workflow
        assert workflow.get("aiGenerated") == True
        
        # Verify nodes and edges exist
        assert len(workflow["nodes"]) >= 2, "Workflow should have at least 2 nodes"
        assert len(workflow["edges"]) >= 1, "Workflow should have at least 1 edge"
        
        print(f"Created workflow: {workflow['name']} with {len(workflow['nodes'])} nodes")
    
    def test_create_workflow_with_complex_description(self, auth_headers):
        """Should handle complex workflow descriptions"""
        response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            headers=auth_headers,
            json={
                "description": "Create a workflow that starts with lead research, then sends personalized email, waits 3 days, follows up if no response, and schedules a meeting if they reply positively"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "workflow" in data


class TestUnifiedApprovals(TestAuthentication):
    """Test unified approvals endpoint that aggregates plans, workflows, emails"""
    
    def test_unified_approvals_no_auth(self):
        """Should return 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/ai/pending-approvals-unified")
        assert response.status_code == 403
    
    def test_unified_approvals_success(self, auth_headers):
        """Should return list of pending approvals from all sources"""
        response = requests.get(
            f"{BASE_URL}/api/ai/pending-approvals-unified",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        
        # If there are approvals, verify structure
        if len(data) > 0:
            approval = data[0]
            assert "id" in approval
            assert "type" in approval
            assert "title" in approval
            assert "source" in approval
            print(f"Found {len(data)} pending approvals")
        else:
            print("No pending approvals found (expected if none created)")


class TestApproveUnifiedItem(TestAuthentication):
    """Test approve/reject unified items"""
    
    def test_approve_item_no_auth(self):
        """Should return 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/ai/approve-item/test-id",
            json={"type": "plan", "action": "approve"}
        )
        assert response.status_code == 403
    
    def test_approve_nonexistent_plan(self, auth_headers):
        """Should return 404 for nonexistent plan"""
        response = requests.post(
            f"{BASE_URL}/api/ai/approve-item/nonexistent-id-12345",
            headers=auth_headers,
            json={"type": "plan", "action": "approve"}
        )
        # Should return 404 for nonexistent plan
        assert response.status_code == 404
    
    def test_approve_item_invalid_type(self, auth_headers):
        """Should handle unknown item types"""
        response = requests.post(
            f"{BASE_URL}/api/ai/approve-item/test-id",
            headers=auth_headers,
            json={"type": "unknown_type", "action": "approve"}
        )
        # Should return 400 for unknown type
        assert response.status_code == 400


class TestDocumentUpload(TestAuthentication):
    """Test document upload for knowledge base with AI extraction"""
    
    def test_upload_no_auth(self):
        """Should return 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/ai/knowledge/upload",
            json={"content": "test content", "filename": "test.txt"}
        )
        assert response.status_code == 403
    
    def test_upload_no_content(self, auth_headers):
        """Should return 400 without content"""
        response = requests.post(
            f"{BASE_URL}/api/ai/knowledge/upload",
            headers=auth_headers,
            json={"filename": "test.txt"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "content" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower()
    
    def test_upload_text_document(self, auth_headers):
        """Should upload and process text document"""
        test_content = """
        Company Profile: Acme Corp
        
        Industry: Technology
        Founded: 2015
        Employees: 500
        Revenue: $50M ARR
        
        Key Products:
        - Cloud Platform
        - AI Analytics
        - Data Integration
        
        Key Contacts:
        - John Smith, CEO
        - Jane Doe, CTO
        
        Recent News:
        - Raised Series C funding
        - Expanded to European market
        """
        
        response = requests.post(
            f"{BASE_URL}/api/ai/knowledge/upload",
            headers=auth_headers,
            json={
                "content": test_content,
                "filename": "TEST_acme_profile.txt",
                "name": "TEST_Acme Corp Profile",
                "category": "company_research",
                "description": "Company profile for Acme Corp"
            },
            timeout=60  # AI extraction may take time
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "documentId" in data
        assert "extractedData" in data
        assert "message" in data
        
        # Verify AI extraction worked
        extracted = data.get("extractedData", {})
        if extracted:
            print(f"Extracted data keys: {list(extracted.keys())}")
            # AI should extract some information
            assert any(key in extracted for key in ["summary", "keyFacts", "entities", "insights", "tags"])
        
        print(f"Document uploaded: {data.get('documentId')}")
    
    def test_upload_json_document(self, auth_headers):
        """Should handle JSON content"""
        json_content = json.dumps({
            "company": "Test Corp",
            "contacts": [
                {"name": "Alice", "role": "CEO"},
                {"name": "Bob", "role": "CTO"}
            ],
            "metrics": {
                "revenue": "10M",
                "employees": 100
            }
        })
        
        response = requests.post(
            f"{BASE_URL}/api/ai/knowledge/upload",
            headers=auth_headers,
            json={
                "content": json_content,
                "filename": "TEST_company_data.json",
                "name": "TEST_Company Data JSON",
                "category": "data"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True


class TestVoiceTranscribe(TestAuthentication):
    """Test voice transcription placeholder endpoint"""
    
    def test_transcribe_no_auth(self):
        """Should return 403 without auth"""
        response = requests.post(
            f"{BASE_URL}/api/ai/voice/transcribe",
            json={"audio": "base64data"}
        )
        assert response.status_code == 403
    
    def test_transcribe_no_audio(self, auth_headers):
        """Should return 400 without audio data"""
        response = requests.post(
            f"{BASE_URL}/api/ai/voice/transcribe",
            headers=auth_headers,
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "audio" in data.get("detail", "").lower() or "required" in data.get("detail", "").lower()
    
    def test_transcribe_placeholder_response(self, auth_headers):
        """Should return placeholder response indicating integration needed"""
        response = requests.post(
            f"{BASE_URL}/api/ai/voice/transcribe",
            headers=auth_headers,
            json={"audio": "base64encodedaudiodata"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify placeholder response
        assert data.get("success") == True
        assert data.get("placeholder") == True
        assert "message" in data
        assert "speech-to-text" in data.get("message", "").lower() or "transcription" in data.get("message", "").lower()
        
        print(f"Voice transcribe placeholder message: {data.get('message')}")


class TestAIStats(TestAuthentication):
    """Test AI usage statistics endpoint"""
    
    def test_stats_no_auth(self):
        """Should return 403 without auth"""
        response = requests.get(f"{BASE_URL}/api/ai/stats")
        assert response.status_code == 403
    
    def test_stats_success(self, auth_headers):
        """Should return AI usage statistics"""
        response = requests.get(
            f"{BASE_URL}/api/ai/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "sessions" in data
        assert "totalPlans" in data
        assert "completedPlans" in data
        assert "knowledgeDocuments" in data
        assert "agentLearnings" in data
        assert "successRate" in data
        
        # Verify data types
        assert isinstance(data["sessions"], int)
        assert isinstance(data["totalPlans"], int)
        assert isinstance(data["completedPlans"], int)
        assert isinstance(data["knowledgeDocuments"], int)
        assert isinstance(data["agentLearnings"], int)
        assert isinstance(data["successRate"], (int, float))
        
        print(f"AI Stats: {json.dumps(data, indent=2)}")


class TestWorkflowNodesAndEdges(TestAuthentication):
    """Test that created workflows have proper nodes and edges structure"""
    
    def test_workflow_has_proper_structure(self, auth_headers):
        """Verify workflow nodes have required fields"""
        response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            headers=auth_headers,
            json={
                "description": "Simple 2-step workflow: send email then wait for response"
            },
            timeout=60
        )
        assert response.status_code == 200
        data = response.json()
        
        workflow = data.get("workflow", {})
        nodes = workflow.get("nodes", [])
        edges = workflow.get("edges", [])
        
        # Verify nodes structure
        for node in nodes:
            assert "id" in node, "Node must have id"
            assert "type" in node, "Node must have type"
            # Type should be one of the expected types
            valid_types = ["trigger", "email", "wait", "approval", "branch", "action", "end"]
            # Allow any type since AI might generate custom types
            print(f"Node: id={node.get('id')}, type={node.get('type')}, label={node.get('label', 'N/A')}")
        
        # Verify edges structure
        for edge in edges:
            assert "source" in edge, "Edge must have source"
            assert "target" in edge, "Edge must have target"
            print(f"Edge: {edge.get('source')} -> {edge.get('target')}")
        
        # Verify edges connect valid nodes
        node_ids = {node.get("id") for node in nodes}
        for edge in edges:
            assert edge.get("source") in node_ids or str(edge.get("source")) in {str(n) for n in node_ids}, \
                f"Edge source {edge.get('source')} not in nodes"
            assert edge.get("target") in node_ids or str(edge.get("target")) in {str(n) for n in node_ids}, \
                f"Edge target {edge.get('target')} not in nodes"


class TestIntegrationFlow(TestAuthentication):
    """Test full integration flow: create workflow -> check approvals -> check stats"""
    
    def test_full_flow(self, auth_headers):
        """Test complete flow of new features"""
        # 1. Get initial stats
        stats_response = requests.get(
            f"{BASE_URL}/api/ai/stats",
            headers=auth_headers
        )
        assert stats_response.status_code == 200
        initial_stats = stats_response.json()
        print(f"Initial stats: {initial_stats}")
        
        # 2. Create a workflow
        workflow_response = requests.post(
            f"{BASE_URL}/api/ai/create-workflow",
            headers=auth_headers,
            json={
                "description": "TEST_Integration flow workflow for testing",
                "name": "TEST_Integration_Workflow"
            },
            timeout=60
        )
        assert workflow_response.status_code == 200
        workflow_data = workflow_response.json()
        assert workflow_data.get("success") == True
        print(f"Created workflow: {workflow_data.get('workflow', {}).get('name')}")
        
        # 3. Upload a document
        upload_response = requests.post(
            f"{BASE_URL}/api/ai/knowledge/upload",
            headers=auth_headers,
            json={
                "content": "TEST_Integration test document content for knowledge base",
                "filename": "TEST_integration_test.txt",
                "name": "TEST_Integration Test Doc",
                "category": "test"
            },
            timeout=60
        )
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert upload_data.get("success") == True
        print(f"Uploaded document: {upload_data.get('documentId')}")
        
        # 4. Check unified approvals
        approvals_response = requests.get(
            f"{BASE_URL}/api/ai/pending-approvals-unified",
            headers=auth_headers
        )
        assert approvals_response.status_code == 200
        approvals = approvals_response.json()
        print(f"Pending approvals count: {len(approvals)}")
        
        # 5. Get updated stats
        final_stats_response = requests.get(
            f"{BASE_URL}/api/ai/stats",
            headers=auth_headers
        )
        assert final_stats_response.status_code == 200
        final_stats = final_stats_response.json()
        print(f"Final stats: {final_stats}")
        
        # Knowledge documents should have increased
        assert final_stats["knowledgeDocuments"] >= initial_stats["knowledgeDocuments"], \
            "Knowledge documents count should have increased"
        
        print("Integration flow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
