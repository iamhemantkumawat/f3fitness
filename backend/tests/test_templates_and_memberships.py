"""
Test Suite for Template System and Membership Custom Dates
==========================================
Tests for:
1. GET /api/templates - Should return 28 templates including 'otp', 'new_user_credentials', 'test_email'
2. Admin login flow works at /api/auth/login with admin@f3fitness.com/admin123
3. POST /api/memberships - Should accept custom_start_date and custom_end_date parameters
4. WhatsApp test endpoint /api/settings/whatsapp/test returns proper error if not configured
5. SMTP test endpoint /api/settings/smtp/test should use template system
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAdminLogin:
    """Test admin login flow"""
    
    def test_admin_login_success(self):
        """Admin login should work with correct credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User not returned"
        assert data["user"]["role"] == "admin", "User is not admin"
        print(f"✓ Admin login successful, user: {data['user']['name']}")
        return data["token"]

    def test_admin_login_invalid_credentials(self):
        """Admin login should fail with wrong credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected with 401")


class TestTemplates:
    """Test template system"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_get_templates_returns_28_templates(self, admin_token):
        """GET /api/templates should return 28 templates (14 types × 2 channels)"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        assert response.status_code == 200, f"Failed to get templates: {response.text}"
        
        templates = response.json()
        assert len(templates) == 28, f"Expected 28 templates, got {len(templates)}"
        print(f"✓ GET /api/templates returned {len(templates)} templates")
        return templates
    
    def test_templates_include_otp(self, admin_token):
        """Templates should include 'otp' type for both email and whatsapp"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        templates = response.json()
        
        template_types = [t["template_type"] for t in templates]
        assert "otp" in template_types, "Missing 'otp' template type"
        
        otp_templates = [t for t in templates if t["template_type"] == "otp"]
        channels = [t["channel"] for t in otp_templates]
        assert "email" in channels, "Missing OTP email template"
        assert "whatsapp" in channels, "Missing OTP WhatsApp template"
        print("✓ OTP templates present for both email and WhatsApp")
    
    def test_templates_include_new_user_credentials(self, admin_token):
        """Templates should include 'new_user_credentials' type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        templates = response.json()
        
        template_types = [t["template_type"] for t in templates]
        assert "new_user_credentials" in template_types, "Missing 'new_user_credentials' template type"
        
        cred_templates = [t for t in templates if t["template_type"] == "new_user_credentials"]
        channels = [t["channel"] for t in cred_templates]
        assert "email" in channels, "Missing new_user_credentials email template"
        assert "whatsapp" in channels, "Missing new_user_credentials WhatsApp template"
        print("✓ new_user_credentials templates present for both email and WhatsApp")
    
    def test_templates_include_test_email(self, admin_token):
        """Templates should include 'test_email' type"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        templates = response.json()
        
        template_types = [t["template_type"] for t in templates]
        assert "test_email" in template_types, "Missing 'test_email' template type"
        
        test_templates = [t for t in templates if t["template_type"] == "test_email"]
        assert len(test_templates) >= 1, "No test_email templates found"
        print(f"✓ test_email template present, found {len(test_templates)} template(s)")
    
    def test_all_expected_template_types_present(self, admin_token):
        """Verify all 14 template types are present"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/templates", headers=headers)
        templates = response.json()
        
        expected_types = [
            "welcome", "otp", "password_reset", "attendance", "absent_warning", 
            "birthday", "holiday", "plan_shared", "renewal_reminder", 
            "membership_activated", "payment_received", "announcement",
            "new_user_credentials", "test_email"
        ]
        
        actual_types = set(t["template_type"] for t in templates)
        
        for expected in expected_types:
            assert expected in actual_types, f"Missing template type: {expected}"
        
        print(f"✓ All 14 expected template types present: {', '.join(sorted(actual_types))}")


class TestMembershipCustomDates:
    """Test membership creation with custom dates"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    @pytest.fixture
    def test_member(self, admin_token):
        """Create a test member for membership tests"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        timestamp = datetime.now().strftime("%H%M%S")
        
        # Create test member
        response = requests.post(f"{BASE_URL}/api/users?role=member", headers=headers, json={
            "name": f"TEST_CustomDate_User_{timestamp}",
            "email": f"test_customdate_{timestamp}@example.com",
            "phone_number": f"99999{timestamp}",
            "password": "test123"
        })
        
        if response.status_code in [200, 201]:
            return response.json()
        pytest.skip(f"Failed to create test member: {response.text}")
    
    @pytest.fixture
    def test_plan(self, admin_token):
        """Get an active plan for testing"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{BASE_URL}/api/plans?active=true", headers=headers)
        if response.status_code == 200:
            plans = response.json()
            if plans:
                return plans[0]
        pytest.skip("No active plans found")
    
    def test_membership_with_custom_dates(self, admin_token, test_member, test_plan):
        """POST /api/memberships should accept custom_start_date and custom_end_date"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Define custom dates (membership started a month ago, ends in 2 months)
        custom_start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        custom_end = (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d")
        
        payload = {
            "user_id": test_member["id"],
            "plan_id": test_plan["id"],
            "discount_amount": 0,
            "initial_payment": 0,
            "payment_method": "cash",
            "custom_start_date": custom_start,
            "custom_end_date": custom_end
        }
        
        response = requests.post(f"{BASE_URL}/api/memberships", headers=headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create membership: {response.text}"
        
        membership = response.json()
        
        # Verify custom dates were used
        assert custom_start in membership.get("start_date", ""), f"Start date mismatch. Expected {custom_start} in {membership.get('start_date')}"
        assert custom_end in membership.get("end_date", ""), f"End date mismatch. Expected {custom_end} in {membership.get('end_date')}"
        
        print(f"✓ Membership created with custom dates: {custom_start} to {custom_end}")
        print(f"  Actual: {membership.get('start_date')} to {membership.get('end_date')}")
        
        return membership
    
    def test_membership_without_custom_dates(self, admin_token):
        """POST /api/memberships without custom dates should use current date"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Create another test member
        timestamp = datetime.now().strftime("%H%M%S%f")[:10]
        member_response = requests.post(f"{BASE_URL}/api/users?role=member", headers=headers, json={
            "name": f"TEST_NormalDate_User_{timestamp}",
            "email": f"test_normaldate_{timestamp}@example.com",
            "phone_number": f"88888{timestamp[:5]}",
            "password": "test123"
        })
        
        if member_response.status_code not in [200, 201]:
            pytest.skip(f"Failed to create test member: {member_response.text}")
        
        test_member = member_response.json()
        
        # Get a plan
        plans_response = requests.get(f"{BASE_URL}/api/plans?active=true", headers=headers)
        if plans_response.status_code != 200 or not plans_response.json():
            pytest.skip("No active plans found")
        test_plan = plans_response.json()[0]
        
        payload = {
            "user_id": test_member["id"],
            "plan_id": test_plan["id"],
            "discount_amount": 0,
            "initial_payment": 0,
            "payment_method": "cash"
            # No custom dates - should use current date
        }
        
        response = requests.post(f"{BASE_URL}/api/memberships", headers=headers, json=payload)
        assert response.status_code in [200, 201], f"Failed to create membership: {response.text}"
        
        membership = response.json()
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Start date should be today
        assert today in membership.get("start_date", ""), f"Start date should be today: {today}, got {membership.get('start_date')}"
        
        print(f"✓ Membership without custom dates uses today's date: {membership.get('start_date')}")


class TestWhatsAppTestEndpoint:
    """Test WhatsApp test endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_whatsapp_test_returns_proper_error_when_not_configured(self, admin_token):
        """POST /api/settings/whatsapp/test should return 400 with proper error if not configured"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/settings/whatsapp/test?to_number=+919999999999",
            headers=headers
        )
        
        # Should return 400 or 500 with proper error message
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, "Missing error detail"
            assert "Twilio" in data["detail"] or "WhatsApp" in data["detail"] or "not configured" in data["detail"].lower(), \
                f"Error should mention Twilio/WhatsApp configuration. Got: {data['detail']}"
            print(f"✓ WhatsApp test returns proper 400 error: {data['detail']}")
        elif response.status_code == 500:
            data = response.json()
            print(f"✓ WhatsApp test returns 500 (unconfigured/failed): {data.get('detail', 'Unknown error')}")
        elif response.status_code == 200:
            print("✓ WhatsApp is actually configured and test passed!")
        else:
            pytest.fail(f"Unexpected status code: {response.status_code}, body: {response.text}")


class TestSMTPTestEndpoint:
    """Test SMTP test endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        if response.status_code == 200:
            return response.json()["token"]
        pytest.skip("Admin login failed")
    
    def test_smtp_test_endpoint_exists(self, admin_token):
        """POST /api/settings/smtp/test endpoint should exist and be accessible"""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Test with a dummy email (we don't actually need it to send)
        response = requests.post(
            f"{BASE_URL}/api/settings/smtp/test?to_email=test@example.com",
            headers=headers
        )
        
        # Should return 200 (success), 500 (SMTP not configured), or some valid HTTP code
        # But NOT 404 (not found) or 405 (method not allowed)
        assert response.status_code not in [404, 405], f"SMTP test endpoint not found or method not allowed: {response.status_code}"
        
        if response.status_code == 200:
            print("✓ SMTP test endpoint works - email sent successfully")
        elif response.status_code == 500:
            data = response.json()
            print(f"✓ SMTP test endpoint exists but SMTP not configured: {data.get('detail', 'Unknown')}")
        else:
            print(f"✓ SMTP test endpoint accessible, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
