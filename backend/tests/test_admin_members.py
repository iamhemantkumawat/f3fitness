"""
Test Admin Member Management Features:
- GET /admin/users-with-membership - Users with membership data
- POST /admin/users/bulk-delete - Bulk delete users
- POST /admin/users/{id}/toggle-status - Disable/Enable user
- POST /admin/users/{id}/reset-password - Admin password reset
- POST /admin/users/{id}/revoke-membership - Revoke membership
"""
import pytest
import requests
import os
import random
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@f3fitness.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin token for authenticated requests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin token"""
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


class TestGetUsersWithMembership:
    """Test GET /admin/users-with-membership endpoint"""
    
    def test_get_all_members_with_membership(self, admin_headers):
        """Test getting all members with their membership data"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure of response
        if len(data) > 0:
            member = data[0]
            assert "id" in member
            assert "member_id" in member
            assert "name" in member
            assert "email" in member
            assert "phone_number" in member
            assert "active_membership" in member  # This is the new field
    
    def test_membership_data_structure(self, admin_headers):
        """Test that active_membership contains correct fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Find a member with active membership
        members_with_membership = [m for m in data if m.get("active_membership")]
        if len(members_with_membership) > 0:
            membership = members_with_membership[0]["active_membership"]
            assert "plan_name" in membership, "Missing plan_name in membership"
            assert "start_date" in membership, "Missing start_date in membership"
            assert "end_date" in membership, "Missing end_date in membership"
            assert "status" in membership, "Missing status in membership"
            print(f"Found member with membership: plan={membership['plan_name']}, expiry={membership['end_date']}")
    
    def test_filter_by_status_active(self, admin_headers):
        """Test filtering members by active status (has membership)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "status": "active"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned members should have active membership
        for member in data:
            assert member.get("active_membership") is not None, f"Member {member['name']} should have active membership"
    
    def test_filter_by_status_inactive(self, admin_headers):
        """Test filtering members by inactive status (no membership)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "status": "inactive"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # All returned members should NOT have active membership
        for member in data:
            assert member.get("active_membership") is None, f"Member {member['name']} should NOT have active membership"
    
    def test_search_by_name(self, admin_headers):
        """Test searching members by name"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "search": "Test"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        # If results exist, they should match the search
        print(f"Search 'Test' returned {len(data)} results")
    
    def test_search_by_member_id(self, admin_headers):
        """Test searching members by member_id"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "search": "F3-0004"},
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            assert "F3-0004" in data[0]["member_id"]


class TestToggleUserStatus:
    """Test POST /admin/users/{id}/toggle-status endpoint"""
    
    @pytest.fixture
    def test_user(self, admin_headers):
        """Create a test user for status toggle tests"""
        random_suffix = ''.join(random.choices(string.digits, k=6))
        response = requests.post(
            f"{BASE_URL}/api/users",
            params={"role": "member"},
            json={
                "name": f"TEST_StatusToggle_{random_suffix}",
                "email": f"test_toggle_{random_suffix}@example.com",
                "phone_number": f"99{random_suffix}",
                "password": "testpass123"
            },
            headers=admin_headers
        )
        assert response.status_code == 200
        user = response.json()
        yield user
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=admin_headers)
    
    def test_disable_user(self, admin_headers, test_user):
        """Test disabling a user account"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{test_user['id']}/toggle-status",
            json={"action": "disable"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "disabled" in response.json()["message"].lower()
        
        # Verify user is disabled
        users_response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "status": "disabled"},
            headers=admin_headers
        )
        disabled_users = users_response.json()
        disabled_ids = [u["id"] for u in disabled_users]
        assert test_user["id"] in disabled_ids or any(u.get("is_disabled") for u in disabled_users if u["id"] == test_user["id"])
    
    def test_enable_user(self, admin_headers, test_user):
        """Test enabling a disabled user account"""
        # First disable
        requests.post(
            f"{BASE_URL}/api/admin/users/{test_user['id']}/toggle-status",
            json={"action": "disable"},
            headers=admin_headers
        )
        
        # Then enable
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{test_user['id']}/toggle-status",
            json={"action": "enable"},
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "enabled" in response.json()["message"].lower()
    
    def test_cannot_disable_admin(self, admin_headers):
        """Test that admin user cannot be disabled"""
        # Get admin user ID
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_phone": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        admin_id = login_response.json()["user"]["id"]
        
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{admin_id}/toggle-status",
            json={"action": "disable"},
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "admin" in response.json()["detail"].lower()


class TestResetPassword:
    """Test POST /admin/users/{id}/reset-password endpoint"""
    
    @pytest.fixture
    def test_user_for_reset(self, admin_headers):
        """Create a test user for password reset tests"""
        random_suffix = ''.join(random.choices(string.digits, k=6))
        response = requests.post(
            f"{BASE_URL}/api/users",
            params={"role": "member"},
            json={
                "name": f"TEST_PwdReset_{random_suffix}",
                "email": f"test_reset_{random_suffix}@example.com",
                "phone_number": f"88{random_suffix}",
                "password": "oldpassword123"
            },
            headers=admin_headers
        )
        assert response.status_code == 200
        user = response.json()
        yield user
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=admin_headers)
    
    def test_reset_password_success(self, admin_headers, test_user_for_reset):
        """Test admin can reset user password"""
        new_password = "newpassword456"
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{test_user_for_reset['id']}/reset-password",
            json={"new_password": new_password},
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify new password works
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": test_user_for_reset["email"],
                "password": new_password
            }
        )
        assert login_response.status_code == 200
    
    def test_reset_password_too_short(self, admin_headers, test_user_for_reset):
        """Test password reset with too short password fails"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/{test_user_for_reset['id']}/reset-password",
            json={"new_password": "12345"},  # Less than 6 characters
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "6 characters" in response.json()["detail"]
    
    def test_reset_password_user_not_found(self, admin_headers):
        """Test password reset for non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/non-existent-id/reset-password",
            json={"new_password": "newpassword123"},
            headers=admin_headers
        )
        assert response.status_code == 404


class TestBulkDelete:
    """Test POST /admin/users/bulk-delete endpoint"""
    
    def test_bulk_delete_success(self, admin_headers):
        """Test bulk deleting multiple users"""
        # Create test users
        user_ids = []
        for i in range(3):
            random_suffix = ''.join(random.choices(string.digits, k=6))
            response = requests.post(
                f"{BASE_URL}/api/users",
                params={"role": "member"},
                json={
                    "name": f"TEST_BulkDel_{random_suffix}",
                    "email": f"test_bulk_{random_suffix}@example.com",
                    "phone_number": f"77{random_suffix}",
                    "password": "testpass123"
                },
                headers=admin_headers
            )
            if response.status_code == 200:
                user_ids.append(response.json()["id"])
        
        assert len(user_ids) > 0, "Failed to create test users for bulk delete"
        
        # Bulk delete
        response = requests.post(
            f"{BASE_URL}/api/admin/users/bulk-delete",
            json=user_ids,
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["deleted_count"] == len(user_ids)
        
        # Verify users are deleted
        for user_id in user_ids:
            get_response = requests.get(
                f"{BASE_URL}/api/users/{user_id}",
                headers=admin_headers
            )
            assert get_response.status_code == 404
    
    def test_bulk_delete_empty_list(self, admin_headers):
        """Test bulk delete with empty list"""
        response = requests.post(
            f"{BASE_URL}/api/admin/users/bulk-delete",
            json=[],
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["deleted_count"] == 0


class TestRevokeMembership:
    """Test POST /admin/users/{id}/revoke-membership endpoint"""
    
    def test_revoke_membership_success(self, admin_headers):
        """Test revoking an active membership"""
        # Find a member with active membership
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "status": "active"},
            headers=admin_headers
        )
        members_with_membership = response.json()
        
        if len(members_with_membership) == 0:
            pytest.skip("No members with active membership found")
        
        # Use the first member with membership
        member = members_with_membership[0]
        print(f"Revoking membership for: {member['name']} (Plan: {member['active_membership']['plan_name']})")
        
        # Revoke membership
        revoke_response = requests.post(
            f"{BASE_URL}/api/admin/users/{member['id']}/revoke-membership",
            headers=admin_headers
        )
        assert revoke_response.status_code == 200
        assert "revoked" in revoke_response.json()["message"].lower()
        
        # Verify membership is revoked
        updated_response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "search": member["member_id"]},
            headers=admin_headers
        )
        updated_member = updated_response.json()[0]
        # After revoke, active_membership should be None
        assert updated_member.get("active_membership") is None or updated_member["active_membership"].get("status") == "revoked"
    
    def test_revoke_membership_no_active_membership(self, admin_headers):
        """Test revoking membership for user without active membership"""
        # Find a member without membership
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership",
            params={"role": "member", "status": "inactive"},
            headers=admin_headers
        )
        members_without_membership = response.json()
        
        if len(members_without_membership) == 0:
            pytest.skip("No members without membership found")
        
        member = members_without_membership[0]
        
        # Try to revoke (should fail)
        revoke_response = requests.post(
            f"{BASE_URL}/api/admin/users/{member['id']}/revoke-membership",
            headers=admin_headers
        )
        assert revoke_response.status_code == 400
        assert "no active membership" in revoke_response.json()["detail"].lower()


class TestCreateMemberWithNotification:
    """Test POST /users endpoint sends welcome notification"""
    
    def test_create_member_success(self, admin_headers):
        """Test creating a new member (notification is sent in background)"""
        random_suffix = ''.join(random.choices(string.digits, k=6))
        response = requests.post(
            f"{BASE_URL}/api/users",
            params={"role": "member"},
            json={
                "name": f"TEST_NewMember_{random_suffix}",
                "email": f"test_new_{random_suffix}@example.com",
                "phone_number": f"66{random_suffix}",
                "password": "welcome123",
                "gender": "male"
            },
            headers=admin_headers
        )
        assert response.status_code == 200
        user = response.json()
        
        # Verify user created
        assert user["name"] == f"TEST_NewMember_{random_suffix}"
        assert user["member_id"].startswith("F3-")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/users/{user['id']}", headers=admin_headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
