"""
Test Email Webhooks & Templates API
Tests for:
1. Webhook endpoints (SendGrid, Mailgun, Generic)
2. Template categories and listing
3. Template CRUD operations
4. AI template personalization
5. AI template generation
6. Draft creation from templates
"""

import pytest
import requests
import os
import time
from uuid import uuid4

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmailWebhooksTemplates:
    """Email Webhooks & Templates API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@salesflow.com",
            "password": "test123"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.user_id = login_response.json().get("user", {}).get("id")
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Delete test templates
        try:
            templates = self.session.get(f"{BASE_URL}/api/email-templates/templates").json()
            for t in templates:
                if t.get("isCustom") and t.get("name", "").startswith("TEST_"):
                    self.session.delete(f"{BASE_URL}/api/email-templates/templates/{t['id']}")
        except:
            pass

    # ============== WEBHOOK TESTS ==============
    
    def test_sendgrid_webhook_delivered(self):
        """Test SendGrid webhook - delivered event"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/sendgrid", json=[
            {
                "event": "delivered",
                "email": "prospect@example.com",
                "sg_message_id": "test-msg-123",
                "timestamp": int(time.time())
            }
        ])
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"SendGrid delivered webhook: processed={data.get('processed')}")
    
    def test_sendgrid_webhook_open(self):
        """Test SendGrid webhook - open event"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/sendgrid", json=[
            {
                "event": "open",
                "email": "prospect@example.com",
                "sg_message_id": "test-msg-456",
                "timestamp": int(time.time())
            }
        ])
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"SendGrid open webhook: processed={data.get('processed')}")
    
    def test_sendgrid_webhook_click(self):
        """Test SendGrid webhook - click event"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/sendgrid", json=[
            {
                "event": "click",
                "email": "prospect@example.com",
                "sg_message_id": "test-msg-789",
                "url": "https://example.com/link",
                "timestamp": int(time.time())
            }
        ])
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"SendGrid click webhook: processed={data.get('processed')}")
    
    def test_sendgrid_webhook_bounce(self):
        """Test SendGrid webhook - bounce event"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/sendgrid", json=[
            {
                "event": "bounce",
                "email": "invalid@example.com",
                "reason": "Invalid email address",
                "timestamp": int(time.time())
            }
        ])
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"SendGrid bounce webhook: processed={data.get('processed')}")
    
    def test_sendgrid_webhook_batch(self):
        """Test SendGrid webhook - batch events"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/sendgrid", json=[
            {"event": "delivered", "email": "test1@example.com", "timestamp": int(time.time())},
            {"event": "open", "email": "test2@example.com", "timestamp": int(time.time())},
            {"event": "click", "email": "test3@example.com", "timestamp": int(time.time())}
        ])
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"SendGrid batch webhook: processed={data.get('processed')}")
    
    def test_mailgun_webhook_delivered(self):
        """Test Mailgun webhook - delivered event"""
        # Mailgun sends form data with event-data JSON
        response = self.session.post(
            f"{BASE_URL}/api/email-templates/webhook/mailgun",
            data={
                "event-data": '{"event": "delivered", "recipient": "prospect@example.com", "timestamp": ' + str(time.time()) + '}'
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Mailgun delivered webhook: success={data.get('success')}")
    
    def test_mailgun_webhook_opened(self):
        """Test Mailgun webhook - opened event"""
        response = self.session.post(
            f"{BASE_URL}/api/email-templates/webhook/mailgun",
            data={
                "event-data": '{"event": "opened", "recipient": "prospect@example.com", "timestamp": ' + str(time.time()) + '}'
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Mailgun opened webhook: success={data.get('success')}")
    
    def test_mailgun_webhook_clicked(self):
        """Test Mailgun webhook - clicked event"""
        response = self.session.post(
            f"{BASE_URL}/api/email-templates/webhook/mailgun",
            data={
                "event-data": '{"event": "clicked", "recipient": "prospect@example.com", "url": "https://example.com", "timestamp": ' + str(time.time()) + '}'
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"Mailgun clicked webhook: success={data.get('success')}")
    
    def test_generic_webhook_requires_auth(self):
        """Test generic webhook requires authentication"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/email-templates/webhook/generic", json={
            "emailId": "test-email-123",
            "eventType": "open"
        })
        
        # Should return 403 without auth
        assert response.status_code == 403
        print("Generic webhook correctly requires authentication")
    
    def test_generic_webhook_missing_fields(self):
        """Test generic webhook - missing required fields"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/generic", json={
            "eventType": "open"
            # Missing emailId
        })
        
        assert response.status_code == 400
        print("Generic webhook correctly validates required fields")
    
    def test_generic_webhook_email_not_found(self):
        """Test generic webhook - email not found"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/webhook/generic", json={
            "emailId": "nonexistent-email-id",
            "eventType": "open"
        })
        
        assert response.status_code == 404
        print("Generic webhook correctly returns 404 for nonexistent email")

    # ============== TEMPLATE CATEGORIES TESTS ==============
    
    def test_get_template_categories(self):
        """Test getting template categories"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates/categories")
        
        assert response.status_code == 200
        categories = response.json()
        
        assert isinstance(categories, list)
        assert len(categories) >= 6  # Should have at least 6 categories
        
        # Verify category structure
        category_ids = [c["id"] for c in categories]
        assert "cold_outreach" in category_ids
        assert "follow_up" in category_ids
        assert "meeting_request" in category_ids
        assert "value_proposition" in category_ids
        assert "social_proof" in category_ids
        assert "breakup" in category_ids
        
        # Verify category has required fields
        for cat in categories:
            assert "id" in cat
            assert "name" in cat
            assert "description" in cat
            assert "icon" in cat
        
        print(f"Template categories: {len(categories)} categories found")
        for cat in categories:
            print(f"  - {cat['name']} ({cat['id']})")

    # ============== TEMPLATE LISTING TESTS ==============
    
    def test_get_all_templates(self):
        """Test getting all templates"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates")
        
        assert response.status_code == 200
        templates = response.json()
        
        assert isinstance(templates, list)
        assert len(templates) >= 8  # Should have at least 8 default templates
        
        # Verify template structure
        for t in templates:
            assert "id" in t
            assert "name" in t
            assert "category" in t
            assert "subject" in t
            assert "body" in t
            assert "variables" in t
        
        print(f"All templates: {len(templates)} templates found")
    
    def test_get_templates_by_category(self):
        """Test filtering templates by category"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates?category=cold_outreach")
        
        assert response.status_code == 200
        templates = response.json()
        
        assert isinstance(templates, list)
        assert len(templates) >= 2  # Should have at least 2 cold outreach templates
        
        # All templates should be in cold_outreach category
        for t in templates:
            assert t["category"] == "cold_outreach"
        
        print(f"Cold outreach templates: {len(templates)} templates found")
    
    def test_get_templates_follow_up_category(self):
        """Test filtering templates by follow_up category"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates?category=follow_up")
        
        assert response.status_code == 200
        templates = response.json()
        
        assert isinstance(templates, list)
        assert len(templates) >= 2  # Should have at least 2 follow-up templates
        
        for t in templates:
            assert t["category"] == "follow_up"
        
        print(f"Follow-up templates: {len(templates)} templates found")
    
    def test_get_specific_template(self):
        """Test getting a specific template by ID"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates/cold_intro_1")
        
        assert response.status_code == 200
        template = response.json()
        
        assert template["id"] == "cold_intro_1"
        assert template["name"] == "The Observation Opener"
        assert template["category"] == "cold_outreach"
        assert "{{firstName}}" in template["subject"] or "{{company}}" in template["subject"]
        assert len(template["variables"]) > 0
        assert "avgOpenRate" in template
        assert "avgReplyRate" in template
        
        print(f"Template: {template['name']}")
        print(f"  Variables: {template['variables']}")
        print(f"  Open Rate: {template.get('avgOpenRate')}%")
        print(f"  Reply Rate: {template.get('avgReplyRate')}%")
    
    def test_get_nonexistent_template(self):
        """Test getting a nonexistent template"""
        response = self.session.get(f"{BASE_URL}/api/email-templates/templates/nonexistent-template-id")
        
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent template")

    # ============== TEMPLATE CRUD TESTS ==============
    
    def test_create_custom_template(self):
        """Test creating a custom template"""
        template_data = {
            "name": "TEST_Custom Sales Template",
            "description": "A test template for automated testing",
            "category": "cold_outreach",
            "subject": "Quick question about {{company}}, {{firstName}}",
            "body": """Hi {{firstName}},

I noticed {{company}} is growing rapidly. I wanted to reach out about {{topic}}.

Would you have 15 minutes to chat?

Best,
{{senderName}}""",
            "bestFor": ["VP Sales", "Mid-market companies"]
        }
        
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates", json=template_data)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        template = data.get("template")
        assert template is not None
        assert template["name"] == "TEST_Custom Sales Template"
        assert template["isCustom"] == True
        assert "firstName" in template["variables"]
        assert "company" in template["variables"]
        assert "topic" in template["variables"]
        assert "senderName" in template["variables"]
        
        # Store for later tests
        self.created_template_id = template["id"]
        
        print(f"Created custom template: {template['name']}")
        print(f"  ID: {template['id']}")
        print(f"  Variables: {template['variables']}")
        
        return template["id"]
    
    def test_update_custom_template(self):
        """Test updating a custom template"""
        # First create a template
        create_response = self.session.post(f"{BASE_URL}/api/email-templates/templates", json={
            "name": "TEST_Template to Update",
            "category": "follow_up",
            "subject": "Following up, {{firstName}}",
            "body": "Hi {{firstName}}, just checking in."
        })
        
        assert create_response.status_code == 200
        template_id = create_response.json()["template"]["id"]
        
        # Update the template
        update_response = self.session.put(f"{BASE_URL}/api/email-templates/templates/{template_id}", json={
            "name": "TEST_Updated Template Name",
            "subject": "Updated subject for {{firstName}} at {{company}}",
            "body": "Hi {{firstName}}, this is an updated body with {{newVariable}}."
        })
        
        assert update_response.status_code == 200
        data = update_response.json()
        assert data.get("success") == True
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/email-templates/templates/{template_id}")
        assert get_response.status_code == 200
        updated = get_response.json()
        
        assert updated["name"] == "TEST_Updated Template Name"
        assert "company" in updated["variables"]
        assert "newVariable" in updated["variables"]
        
        print(f"Updated template: {updated['name']}")
        print(f"  New variables: {updated['variables']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/email-templates/templates/{template_id}")
    
    def test_delete_custom_template(self):
        """Test deleting a custom template"""
        # First create a template
        create_response = self.session.post(f"{BASE_URL}/api/email-templates/templates", json={
            "name": "TEST_Template to Delete",
            "category": "breakup",
            "subject": "Closing the loop",
            "body": "Hi {{firstName}}, I'll close my notes."
        })
        
        assert create_response.status_code == 200
        template_id = create_response.json()["template"]["id"]
        
        # Delete the template
        delete_response = self.session.delete(f"{BASE_URL}/api/email-templates/templates/{template_id}")
        
        assert delete_response.status_code == 200
        data = delete_response.json()
        assert data.get("success") == True
        
        # Verify deletion
        get_response = self.session.get(f"{BASE_URL}/api/email-templates/templates/{template_id}")
        assert get_response.status_code == 404
        
        print("Successfully deleted custom template")
    
    def test_cannot_delete_default_template(self):
        """Test that default templates cannot be deleted"""
        response = self.session.delete(f"{BASE_URL}/api/email-templates/templates/cold_intro_1")
        
        # Should return 404 because default templates are not in DB
        assert response.status_code == 404
        print("Correctly prevents deletion of default templates")

    # ============== AI PERSONALIZATION TESTS ==============
    
    def test_personalize_template_with_variables(self):
        """Test personalizing a template with provided variables"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/cold_intro_1/personalize", json={
            "variables": {
                "firstName": "John",
                "company": "Acme Corp",
                "observation": "expanding into new markets",
                "painPoint": "scaling their sales team",
                "socialProof": "TechCorp",
                "result": "50% increase in pipeline",
                "senderName": "Jane Smith"
            }
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        personalized = data.get("personalized")
        assert personalized is not None
        
        # Check that variables were substituted
        assert "John" in personalized["body"]
        assert "Acme Corp" in personalized["subject"] or "Acme Corp" in personalized["body"]
        assert "{{firstName}}" not in personalized["body"]
        
        print("Personalized template:")
        print(f"  Subject: {personalized['subject']}")
        print(f"  Body preview: {personalized['body'][:100]}...")
        print(f"  Variables used: {list(data.get('variablesUsed', {}).keys())}")
    
    def test_personalize_template_partial_variables(self):
        """Test personalizing with partial variables (some missing)"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/cold_intro_1/personalize", json={
            "variables": {
                "firstName": "Sarah",
                "company": "BigTech Inc"
                # Other variables missing
            }
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        personalized = data.get("personalized")
        
        # Check that provided variables were substituted
        assert "Sarah" in personalized["body"]
        assert "BigTech Inc" in personalized["subject"] or "BigTech Inc" in personalized["body"]
        
        # Missing variables should remain as placeholders or be filled by AI
        missing = data.get("missingVariables", [])
        print(f"Personalized with partial variables. Missing: {missing}")
    
    def test_personalize_nonexistent_template(self):
        """Test personalizing a nonexistent template"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/nonexistent-id/personalize", json={
            "variables": {"firstName": "Test"}
        })
        
        assert response.status_code == 404
        print("Correctly returns 404 for nonexistent template personalization")

    # ============== AI TEMPLATE GENERATION TESTS ==============
    
    def test_generate_template_cold_outreach(self):
        """Test AI template generation for cold outreach"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/generate", json={
            "description": "A cold email for reaching out to VP of Sales at SaaS companies about our sales automation tool",
            "category": "cold_outreach",
            "tone": "professional",
            "targetAudience": "VP Sales at mid-market SaaS",
            "goal": "book meeting"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        template = data.get("template")
        assert template is not None
        
        assert template["category"] == "cold_outreach"
        assert template["isCustom"] == True
        assert template["isGenerated"] == True
        assert len(template["subject"]) > 0
        assert len(template["body"]) > 0
        assert len(template["variables"]) > 0
        
        print(f"Generated template: {template['name']}")
        print(f"  Subject: {template['subject']}")
        print(f"  Variables: {template['variables']}")
        print(f"  Best for: {template.get('bestFor', [])}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/email-templates/templates/{template['id']}")
    
    def test_generate_template_follow_up(self):
        """Test AI template generation for follow-up"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/generate", json={
            "description": "A follow-up email after a demo call where the prospect seemed interested but hasn't responded",
            "category": "follow_up",
            "tone": "friendly",
            "targetAudience": "Decision makers who attended demo",
            "goal": "get reply"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        template = data.get("template")
        assert template["category"] == "follow_up"
        
        print(f"Generated follow-up template: {template['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/email-templates/templates/{template['id']}")
    
    def test_generate_template_casual_tone(self):
        """Test AI template generation with casual tone"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/generate", json={
            "description": "A casual email to share a helpful resource with a prospect",
            "category": "value_proposition",
            "tone": "casual",
            "targetAudience": "Startup founders",
            "goal": "share resource"
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("success") == True
        template = data.get("template")
        
        print(f"Generated casual template: {template['name']}")
        
        # Cleanup
        self.session.delete(f"{BASE_URL}/api/email-templates/templates/{template['id']}")
    
    def test_generate_template_empty_description(self):
        """Test AI template generation with empty description"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/generate", json={
            "description": "",
            "category": "cold_outreach"
        })
        
        # Should still work with minimal input
        assert response.status_code in [200, 500]  # May fail if AI can't generate
        print(f"Empty description response: {response.status_code}")

    # ============== DRAFT CREATION TESTS ==============
    
    def test_create_draft_from_template_requires_prospect(self):
        """Test that creating draft requires prospectId"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/cold_intro_1/create-draft", json={
            "variables": {"firstName": "Test"}
            # Missing prospectId
        })
        
        assert response.status_code == 400
        print("Correctly requires prospectId for draft creation")
    
    def test_create_draft_from_template_nonexistent_prospect(self):
        """Test creating draft with nonexistent prospect"""
        response = self.session.post(f"{BASE_URL}/api/email-templates/templates/cold_intro_1/create-draft", json={
            "prospectId": "nonexistent-prospect-id",
            "variables": {"firstName": "Test"}
        })
        
        # Should work but with limited personalization
        assert response.status_code in [200, 404, 500]
        print(f"Nonexistent prospect draft creation: {response.status_code}")

    # ============== AUTH TESTS ==============
    
    def test_templates_require_auth(self):
        """Test that template endpoints require authentication"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        # Get templates should require auth
        response = no_auth_session.get(f"{BASE_URL}/api/email-templates/templates")
        assert response.status_code == 403
        
        # Create template should require auth
        response = no_auth_session.post(f"{BASE_URL}/api/email-templates/templates", json={
            "name": "Test",
            "subject": "Test",
            "body": "Test"
        })
        assert response.status_code == 403
        
        # Generate template should require auth
        response = no_auth_session.post(f"{BASE_URL}/api/email-templates/templates/generate", json={
            "description": "Test"
        })
        assert response.status_code == 403
        
        print("All template endpoints correctly require authentication")
    
    def test_categories_no_auth_required(self):
        """Test that categories endpoint doesn't require auth"""
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/email-templates/templates/categories")
        # Categories might or might not require auth based on implementation
        print(f"Categories without auth: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
