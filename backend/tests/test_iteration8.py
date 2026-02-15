"""
Iteration 8 - Testing backend APIs and dashboard functionality
Features tested:
- Health check
- Admin login
- Dashboard stats endpoint
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gym-mgmt-staging.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@f3fitness.com"
ADMIN_PASSWORD = "admin123"


class TestHealthCheck:
    """Backend health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy status"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        data = response.json()
        assert data.get("status") == "healthy", f"Unexpected status: {data}"
        assert data.get("service") == "f3fitness-backend", f"Unexpected service name: {data}"
        print("✓ Health check passed")


class TestAdminAuth:
    """Admin authentication tests"""
    
    def test_admin_login_success(self):
        """Test admin can login with correct credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "admin", f"Expected admin role, got: {data['user']['role']}"
        assert data["user"]["email"] == ADMIN_EMAIL, f"Email mismatch: {data['user']['email']}"
        print(f"✓ Admin login success - Member ID: {data['user']['member_id']}")
        return data["token"]
    
    def test_admin_login_wrong_password(self):
        """Test login fails with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": ADMIN_EMAIL,
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("✓ Wrong password correctly rejected")
    
    def test_admin_login_wrong_email(self):
        """Test login fails with wrong email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": "wrong@email.com",
                "password": ADMIN_PASSWORD
            }
        )
        assert response.status_code == 401, f"Expected 401, got: {response.status_code}"
        print("✓ Wrong email correctly rejected")


class TestDashboardStats:
    """Dashboard statistics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert response.status_code == 200, "Admin login failed in setup"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats_returns_correct_structure(self):
        """Test dashboard stats endpoint returns expected fields"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Dashboard stats failed: {response.status_code} - {response.text}"
        data = response.json()
        
        # Verify required fields exist
        required_fields = [
            "total_members",
            "active_memberships", 
            "today_collection",
            "present_today",
            "absent_today"
        ]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Verify data types
        assert isinstance(data["total_members"], int), "total_members should be int"
        assert isinstance(data["active_memberships"], int), "active_memberships should be int"
        assert isinstance(data["today_collection"], (int, float)), "today_collection should be number"
        assert isinstance(data["present_today"], int), "present_today should be int"
        assert isinstance(data["absent_today"], int), "absent_today should be int"
        
        print(f"✓ Dashboard stats returned correctly:")
        print(f"  - Total Members: {data['total_members']}")
        print(f"  - Active Memberships: {data['active_memberships']}")
        print(f"  - Today's Collection: ₹{data['today_collection']}")
        print(f"  - Present Today: {data['present_today']}")
        print(f"  - Absent Today: {data['absent_today']}")
    
    def test_dashboard_stats_has_renewals_and_absentees(self):
        """Test dashboard stats includes upcoming renewals and regular absentees"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for optional but expected fields
        assert "upcoming_renewals" in data, "Missing upcoming_renewals field"
        assert "regular_absentees" in data, "Missing regular_absentees field"
        assert isinstance(data["upcoming_renewals"], list), "upcoming_renewals should be a list"
        assert isinstance(data["regular_absentees"], list), "regular_absentees should be a list"
        
        print(f"✓ Dashboard has renewals ({len(data['upcoming_renewals'])}) and absentees ({len(data['regular_absentees'])})")
    
    def test_dashboard_stats_has_birthdays(self):
        """Test dashboard stats includes birthday data"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check for birthday fields
        assert "today_birthdays" in data, "Missing today_birthdays field"
        assert "upcoming_birthdays" in data, "Missing upcoming_birthdays field"
        assert isinstance(data["today_birthdays"], list), "today_birthdays should be a list"
        assert isinstance(data["upcoming_birthdays"], list), "upcoming_birthdays should be a list"
        
        print(f"✓ Dashboard has birthdays data")
    
    def test_dashboard_stats_requires_auth(self):
        """Test dashboard stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 403, f"Expected 403 without auth, got: {response.status_code}"
        print("✓ Dashboard stats correctly requires authentication")


class TestPublicEndpoints:
    """Test public-facing endpoints"""
    
    def test_plans_public_endpoint(self):
        """Test plans can be fetched publicly"""
        response = requests.get(f"{BASE_URL}/api/plans?active_only=true")
        assert response.status_code == 200, f"Plans fetch failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Plans should return a list"
        print(f"✓ Public plans endpoint works ({len(data)} plans)")
    
    def test_testimonials_public_endpoint(self):
        """Test testimonials can be fetched publicly"""
        response = requests.get(f"{BASE_URL}/api/testimonials")
        assert response.status_code == 200, f"Testimonials fetch failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Testimonials should return a list"
        print(f"✓ Public testimonials endpoint works ({len(data)} testimonials)")
    
    def test_trainers_public_endpoint(self):
        """Test trainers public endpoint"""
        response = requests.get(f"{BASE_URL}/api/trainers/public")
        assert response.status_code == 200, f"Trainers fetch failed: {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Trainers should return a list"
        print(f"✓ Public trainers endpoint works ({len(data)} trainers)")


class TestAuthMe:
    """Test auth/me endpoint"""
    
    def test_auth_me_returns_current_user(self):
        """Test /api/auth/me returns current user details"""
        # First login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email_or_phone": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        # Then get current user
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200, f"Auth me failed: {response.status_code}"
        data = response.json()
        assert data["email"] == ADMIN_EMAIL, f"Email mismatch in auth/me"
        assert data["role"] == "admin", "Role should be admin"
        print(f"✓ Auth/me returns correct user data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
