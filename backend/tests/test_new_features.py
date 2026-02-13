"""
Test New Features: OTP Flow, Admin Dashboard Widgets, Health Tracking
- OTP send API
- Dashboard stats with birthday/renewal/absentee widgets
- Health logs CRUD
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fitness-vps.preview.emergentagent.com')

class TestOTPFlow:
    """OTP endpoint tests"""
    
    def test_send_otp_with_phone_and_email(self):
        """Test OTP send endpoint with both phone and email"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={
                "phone_number": "9876543210",
                "country_code": "+91",
                "email": "test_otp@example.com"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "OTP sent successfully"
        assert data["phone_sent"] == True
        assert data["email_sent"] == True
    
    def test_send_otp_phone_only(self):
        """Test OTP send with phone only (no email)"""
        response = requests.post(
            f"{BASE_URL}/api/otp/send",
            json={
                "phone_number": "8765432109",
                "country_code": "+91"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["phone_sent"] == True
        assert data["email_sent"] == False


class TestAdminDashboard:
    """Admin Dashboard stats with widgets tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_phone": "admin@f3fitness.com", "password": "admin123"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_dashboard_stats_has_birthday_widgets(self, admin_token):
        """Test dashboard stats includes today's and upcoming birthdays"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check all required fields exist
        assert "today_birthdays" in data
        assert "upcoming_birthdays" in data
        assert isinstance(data["today_birthdays"], list)
        assert isinstance(data["upcoming_birthdays"], list)
    
    def test_dashboard_stats_has_renewal_widget(self, admin_token):
        """Test dashboard stats includes upcoming renewals"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "upcoming_renewals" in data
        assert isinstance(data["upcoming_renewals"], list)
    
    def test_dashboard_stats_has_absentee_widget(self, admin_token):
        """Test dashboard stats includes regular absentees"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "regular_absentees" in data
        assert isinstance(data["regular_absentees"], list)
        
        # Verify absentee structure if any exist
        if data["regular_absentees"]:
            absentee = data["regular_absentees"][0]
            assert "name" in absentee
            assert "member_id" in absentee
            assert "days_absent" in absentee
    
    def test_dashboard_stats_basic_fields(self, admin_token):
        """Test dashboard stats has all basic stat fields"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "total_members" in data
        assert "active_memberships" in data
        assert "today_collection" in data
        assert "present_today" in data
        assert "absent_today" in data


class TestHealthLogs:
    """Health Logs CRUD tests"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_phone": "admin@f3fitness.com", "password": "admin123"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin login failed")
    
    def test_create_health_log(self, admin_token):
        """Test creating a health log"""
        response = requests.post(
            f"{BASE_URL}/api/health-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "weight": 72.5,
                "body_fat": 18.5,
                "height": 180,
                "notes": "TEST_health_log_creation"
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "id" in data
        assert data["weight"] == 72.5
        assert data["body_fat"] == 18.5
        assert data["height"] == 180
        assert "bmi" in data
        assert data["bmi"] is not None  # BMI should be calculated
        assert data["notes"] == "TEST_health_log_creation"
    
    def test_create_health_log_bmi_calculation(self, admin_token):
        """Test BMI is correctly calculated"""
        response = requests.post(
            f"{BASE_URL}/api/health-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "weight": 70,
                "height": 175
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # BMI = weight / (height_m)^2 = 70 / (1.75)^2 = 22.86
        expected_bmi = round(70 / (1.75 ** 2), 1)
        assert data["bmi"] == expected_bmi
    
    def test_create_health_log_weight_only(self, admin_token):
        """Test creating health log with only weight (no BMI calculated)"""
        response = requests.post(
            f"{BASE_URL}/api/health-logs",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "weight": 68.0
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["weight"] == 68.0
        assert data["bmi"] is None  # No height = no BMI
    
    def test_get_health_logs(self, admin_token):
        """Test getting health logs"""
        response = requests.get(
            f"{BASE_URL}/api/health-logs",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        if data:
            log = data[0]
            assert "id" in log
            assert "user_id" in log
            assert "logged_at" in log


class TestAuthFlow:
    """Auth endpoint tests"""
    
    def test_admin_login(self):
        """Test admin login"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_phone": "admin@f3fitness.com", "password": "admin123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["role"] == "admin"
    
    def test_invalid_login(self):
        """Test invalid credentials rejected"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email_or_phone": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code == 401
