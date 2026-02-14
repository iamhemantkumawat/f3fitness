"""
Test Iteration 7 - Bug Fixes and New Features

Tests for:
1. Trainer password reset via Edit Trainer dialog
2. Theme toggle functionality (CSS verified in index.css)
3. WhatsApp Broadcast endpoint
4. Email Broadcast endpoint
5. Email Templates settings
6. WhatsApp Templates settings
7. Broadcast menu in sidebar (frontend test)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@f3fitness.com"
ADMIN_PASSWORD = "admin123"


class TestAdminAuth:
    """Test admin authentication"""
    
    def test_admin_login(self):
        """Login as admin to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful - user: {data['user']['name']}")
        return data["token"]


class TestTrainerPasswordReset:
    """Test trainer password reset functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_trainers_list(self, admin_token):
        """Get list of trainers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/users", headers=headers, params={"role": "trainer"})
        assert response.status_code == 200
        trainers = response.json()
        print(f"✓ Found {len(trainers)} trainers")
        return trainers
    
    def test_create_test_trainer(self, admin_token):
        """Create a test trainer for password reset testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        trainer_data = {
            "name": "TEST_Trainer_PwdReset",
            "email": "test_trainer_pwdreset@f3fitness.com",
            "phone_number": "9999888800",
            "password": "oldpassword123"
        }
        response = requests.post(f"{BASE_URL}/api/users?role=trainer", headers=headers, json=trainer_data)
        # May fail if exists, that's ok
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Created test trainer: {data.get('member_id')}")
            return data["id"]
        elif response.status_code == 400:
            # Trainer exists, find them
            response = requests.get(f"{BASE_URL}/api/users", headers=headers, params={"role": "trainer"})
            trainers = response.json()
            for t in trainers:
                if t.get("email") == "test_trainer_pwdreset@f3fitness.com":
                    return t["id"]
        return None
    
    def test_admin_reset_trainer_password(self, admin_token):
        """Test admin can reset trainer password via the correct endpoint"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # First get or create test trainer
        trainer_id = self.test_create_test_trainer(admin_token)
        
        if trainer_id:
            # Test password reset - this is the fixed endpoint
            new_password = "newpassword456"
            response = requests.post(
                f"{BASE_URL}/api/admin/users/{trainer_id}/reset-password",
                headers=headers,
                json={"new_password": new_password}
            )
            
            assert response.status_code == 200, f"Password reset failed: {response.text}"
            data = response.json()
            assert "message" in data
            print(f"✓ Trainer password reset successful: {data['message']}")
            
            # Cleanup - delete test trainer
            requests.delete(f"{BASE_URL}/api/users/{trainer_id}", headers=headers)
        else:
            pytest.skip("Could not create/find test trainer")


class TestBroadcastEndpoints:
    """Test Broadcast functionality (WhatsApp and Email)"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_whatsapp_broadcast_endpoint_exists(self, admin_token):
        """Test that WhatsApp broadcast endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/broadcast/whatsapp",
            headers=headers,
            json={
                "message": "Test message {{name}}",
                "target_audience": "all"
            }
        )
        # Should return 200 even if WhatsApp not configured (messages queued)
        assert response.status_code == 200, f"WhatsApp broadcast failed: {response.text}"
        data = response.json()
        assert "sent_count" in data
        assert "message" in data
        print(f"✓ WhatsApp broadcast endpoint working: {data['message']}")
    
    def test_whatsapp_broadcast_active_members(self, admin_token):
        """Test WhatsApp broadcast to active members only"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/broadcast/whatsapp",
            headers=headers,
            json={
                "message": "Test message for active {{name}}",
                "target_audience": "active"
            }
        )
        assert response.status_code == 200
        print(f"✓ WhatsApp broadcast to active members: {response.json()}")
    
    def test_email_broadcast_endpoint_exists(self, admin_token):
        """Test that Email broadcast endpoint exists"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/broadcast/email?subject=Test%20Broadcast",
            headers=headers,
            json={
                "message": "Test email message to {{name}}",
                "target_audience": "all"
            }
        )
        assert response.status_code == 200, f"Email broadcast failed: {response.text}"
        data = response.json()
        assert "sent_count" in data
        print(f"✓ Email broadcast endpoint working: {data['message']}")
    
    def test_email_broadcast_inactive_members(self, admin_token):
        """Test Email broadcast to inactive members only"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.post(
            f"{BASE_URL}/api/broadcast/email?subject=Test%20Inactive%20Broadcast",
            headers=headers,
            json={
                "message": "Test email for inactive {{name}}",
                "target_audience": "inactive"
            }
        )
        assert response.status_code == 200
        print(f"✓ Email broadcast to inactive members: {response.json()}")


class TestTemplatesEndpoints:
    """Test Templates settings functionality"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_all_templates(self, admin_token):
        """Test fetching all templates"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        assert response.status_code == 200, f"Get templates failed: {response.text}"
        templates = response.json()
        assert isinstance(templates, list)
        assert len(templates) > 0, "Expected at least some default templates"
        print(f"✓ Retrieved {len(templates)} templates")
        
        # Verify both email and whatsapp templates exist
        channels = set(t.get("channel") for t in templates)
        assert "email" in channels, "Email templates should exist"
        assert "whatsapp" in channels, "WhatsApp templates should exist"
        
        # Verify template types
        template_types = set(t.get("template_type") for t in templates)
        print(f"✓ Template types: {template_types}")
        print(f"✓ Channels: {channels}")
    
    def test_update_email_template(self, admin_token):
        """Test updating an email template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update welcome email template
        template_data = {
            "template_type": "welcome",
            "channel": "email",
            "subject": "Welcome to F3 Fitness - TEST",
            "content": "<h1>Welcome {{name}}!</h1><p>Your member ID is {{member_id}}</p>"
        }
        
        response = requests.put(f"{BASE_URL}/api/templates", headers=headers, json=template_data)
        assert response.status_code == 200, f"Update template failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Email template update: {data['message']}")
    
    def test_update_whatsapp_template(self, admin_token):
        """Test updating a WhatsApp template"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Update welcome whatsapp template  
        template_data = {
            "template_type": "welcome",
            "channel": "whatsapp",
            "content": "Welcome to F3 Fitness {{name}}! Your ID: {{member_id}} - TEST"
        }
        
        response = requests.put(f"{BASE_URL}/api/templates", headers=headers, json=template_data)
        assert response.status_code == 200, f"Update WhatsApp template failed: {response.text}"
        print(f"✓ WhatsApp template update successful")
    
    def test_templates_have_required_fields(self, admin_token):
        """Verify templates have required structure"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        templates = response.json()
        
        for template in templates:
            assert "id" in template or "template_type" in template, "Template missing id/type"
            assert "channel" in template, "Template missing channel"
            assert "content" in template, "Template missing content"
            if template["channel"] == "email":
                assert "subject" in template or template.get("subject") == "", "Email template should have subject"
        
        print(f"✓ All {len(templates)} templates have required fields")


class TestAPIURLConfiguration:
    """Test that API URLs are configured correctly"""
    
    def test_base_url_configured(self):
        """Verify BASE_URL is set"""
        assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
        print(f"✓ BASE_URL: {BASE_URL}")
    
    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"✓ Health check passed: {data}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        return response.json()["token"]
    
    def test_cleanup_test_trainers(self, admin_token):
        """Clean up any TEST_ prefixed trainers"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Get trainers
        response = requests.get(f"{BASE_URL}/api/users", headers=headers, params={"role": "trainer"})
        trainers = response.json()
        
        deleted_count = 0
        for trainer in trainers:
            if trainer.get("name", "").startswith("TEST_"):
                del_response = requests.delete(f"{BASE_URL}/api/users/{trainer['id']}", headers=headers)
                if del_response.status_code == 200:
                    deleted_count += 1
        
        print(f"✓ Cleaned up {deleted_count} test trainers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
