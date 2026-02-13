"""
Backend tests for Bug Fixes Iteration 6:
- Edit member page route (not redirecting to home)
- Joining date field in create/edit member
- Admin can edit profile photo and joining date
- Landing page trainer names, Instagram reels, map location
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@f3fitness.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email_or_phone": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def test_member_id(admin_token):
    """Create a test member and return their ID, cleanup after tests"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    # Create test member with joining_date
    response = requests.post(
        f"{BASE_URL}/api/users?role=member",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": f"TEST_BugFix_{timestamp}",
            "email": f"test_bugfix_{timestamp}@test.com",
            "phone_number": f"9{timestamp[-9:]}",
            "password": "test123",
            "country_code": "+91",
            "gender": "male",
            "joining_date": "2024-06-15"
        }
    )
    assert response.status_code == 200, f"Failed to create test member: {response.text}"
    member = response.json()
    member_id = member["id"]
    
    yield member_id
    
    # Cleanup: delete test member
    requests.delete(
        f"{BASE_URL}/api/users/{member_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )


class TestJoiningDateFeature:
    """Tests for joining_date field in create/edit member"""
    
    def test_create_member_with_joining_date(self, admin_token):
        """Backend accepts joining_date when creating new member"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        
        response = requests.post(
            f"{BASE_URL}/api/users?role=member",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": f"TEST_JoiningDate_{timestamp}",
                "email": f"test_jd_{timestamp}@test.com",
                "phone_number": f"8{timestamp[-9:]}",
                "password": "test123",
                "country_code": "+91",
                "joining_date": "2024-03-20"
            }
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify joining_date was set correctly
        assert data.get("joining_date") == "2024-03-20", \
            f"Expected joining_date '2024-03-20', got '{data.get('joining_date')}'"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"✓ Create member with joining_date works")
    
    def test_create_member_without_joining_date_defaults_to_now(self, admin_token):
        """If joining_date not provided, defaults to current timestamp"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S%f")
        today = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.post(
            f"{BASE_URL}/api/users?role=member",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "name": f"TEST_NoJD_{timestamp}",
                "email": f"test_nojd_{timestamp}@test.com",
                "phone_number": f"7{timestamp[-9:]}",
                "password": "test123",
                "country_code": "+91"
            }
        )
        
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify joining_date is set to today (starts with today's date)
        assert data.get("joining_date") is not None, "joining_date should not be None"
        assert data["joining_date"].startswith(today), \
            f"Expected joining_date to start with '{today}', got '{data.get('joining_date')}'"
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/users/{data['id']}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"✓ Create member without joining_date defaults to today")
    
    def test_update_member_joining_date(self, admin_token, test_member_id):
        """Backend accepts joining_date when updating member"""
        new_date = "2023-12-25"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"joining_date": new_date}
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        # Verify joining_date was updated
        assert data.get("joining_date") == new_date, \
            f"Expected joining_date '{new_date}', got '{data.get('joining_date')}'"
        
        print(f"✓ Update member joining_date works")


class TestProfilePhotoFeature:
    """Tests for profile photo editing"""
    
    def test_update_member_profile_photo_url(self, admin_token, test_member_id):
        """Backend accepts profile_photo_url when updating member"""
        new_photo_url = "https://example.com/test-photo-12345.jpg"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"profile_photo_url": new_photo_url}
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        # Verify profile_photo_url was updated
        assert data.get("profile_photo_url") == new_photo_url, \
            f"Expected profile_photo_url '{new_photo_url}', got '{data.get('profile_photo_url')}'"
        
        print(f"✓ Update member profile_photo_url works")
    
    def test_update_both_joining_date_and_photo(self, admin_token, test_member_id):
        """Backend accepts both joining_date and profile_photo_url in single update"""
        new_date = "2024-01-15"
        new_photo = "https://example.com/combined-test.jpg"
        
        response = requests.put(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "joining_date": new_date,
                "profile_photo_url": new_photo
            }
        )
        
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        
        assert data.get("joining_date") == new_date
        assert data.get("profile_photo_url") == new_photo
        
        print(f"✓ Update member with both joining_date and profile_photo_url works")


class TestGetUserById:
    """Tests for fetching user by ID (for edit page)"""
    
    def test_get_user_by_id_returns_joining_date(self, admin_token, test_member_id):
        """GET user by ID returns joining_date field"""
        response = requests.get(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200, f"GET failed: {response.text}"
        data = response.json()
        
        # Verify joining_date is in response
        assert "joining_date" in data, "joining_date field missing from user response"
        assert data["joining_date"] is not None, "joining_date should not be None"
        
        print(f"✓ GET user by ID returns joining_date")
    
    def test_get_user_by_id_returns_profile_photo(self, admin_token, test_member_id):
        """GET user by ID returns profile_photo_url field"""
        response = requests.get(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # profile_photo_url field should exist (even if None)
        assert "profile_photo_url" in data, "profile_photo_url field missing from user response"
        
        print(f"✓ GET user by ID returns profile_photo_url")


class TestUserUpdate:
    """Tests for UserUpdate model accepting new fields"""
    
    def test_user_update_model_accepts_joining_date(self, admin_token, test_member_id):
        """UserUpdate model accepts joining_date field"""
        response = requests.put(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"joining_date": "2024-05-01"}
        )
        
        # Should not reject the field
        assert response.status_code == 200, \
            f"UserUpdate rejected joining_date: {response.text}"
        print(f"✓ UserUpdate model accepts joining_date")
    
    def test_user_update_model_accepts_profile_photo_url(self, admin_token, test_member_id):
        """UserUpdate model accepts profile_photo_url field"""
        response = requests.put(
            f"{BASE_URL}/api/users/{test_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"profile_photo_url": "https://example.com/photo.jpg"}
        )
        
        assert response.status_code == 200, \
            f"UserUpdate rejected profile_photo_url: {response.text}"
        print(f"✓ UserUpdate model accepts profile_photo_url")


class TestMembersListWithMembership:
    """Tests for admin/users-with-membership endpoint"""
    
    def test_members_list_includes_joining_date(self, admin_token):
        """Members list endpoint returns joining_date for each member"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users-with-membership?role=member",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert response.status_code == 200
        members = response.json()
        
        # Check first member has joining_date
        if members:
            member = members[0]
            assert "joining_date" in member, \
                f"joining_date missing from member in list. Keys: {member.keys()}"
            print(f"✓ Members list includes joining_date (found: {member.get('joining_date')})")
        else:
            pytest.skip("No members found to verify")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
