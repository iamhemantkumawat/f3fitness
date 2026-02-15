"""
Comprehensive Backend Tests for F3 Fitness Gym - Auth & Profile Features
Tests: Signup with OTP, Login, Forgot Password, Profile Update, Change Password
"""
import pytest
import requests
import os
import random
import string
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://gym-mgmt-staging.preview.emergentagent.com').rstrip('/')

# Test credentials from context
ADMIN_CREDS = {"email_or_phone": "admin@f3fitness.com", "password": "admin123"}
MEMBER_CREDS = {"email_or_phone": "context_test@example.com", "password": "testpass123"}

# MongoDB for OTP retrieval
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

def get_mongo_client():
    return MongoClient(MONGO_URL)

def generate_unique_id():
    return ''.join(random.choices(string.digits, k=6))

class TestLoginAPI:
    """Test Login API functionality"""
    
    def test_admin_login_success(self):
        """Test admin can login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User data not returned"
        assert data["user"]["role"] == "admin", "Role should be admin"
        assert data["user"]["email"] == "admin@f3fitness.com"
        print(f"✓ Admin login successful - Member ID: {data['user']['member_id']}")
    
    def test_member_login_success(self):
        """Test member can login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MEMBER_CREDS)
        assert response.status_code == 200, f"Member login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User data not returned"
        assert data["user"]["role"] == "member", "Role should be member"
        print(f"✓ Member login successful - Member ID: {data['user']['member_id']}")
    
    def test_login_invalid_credentials(self):
        """Test login fails with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "invalid@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Should reject invalid credentials: {response.text}"
        print("✓ Invalid credentials correctly rejected with 401")
    
    def test_login_with_phone_number(self):
        """Test login works with phone number instead of email"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "4444444444",  # Phone of context_test user
            "password": "testpass123"
        })
        assert response.status_code == 200, f"Login with phone failed: {response.text}"
        data = response.json()
        assert data["user"]["email"] == "context_test@example.com"
        print("✓ Login with phone number successful")


class TestSignupOTPFlow:
    """Test Complete Signup Flow with OTP verification"""
    
    def test_send_otp_for_new_user(self):
        """Test OTP can be sent for new user"""
        unique_id = generate_unique_id()
        response = requests.post(f"{BASE_URL}/api/otp/send", json={
            "phone_number": f"98765{unique_id}",
            "country_code": "+91",
            "email": f"newuser_{unique_id}@test.com"
        })
        assert response.status_code == 200, f"OTP send failed: {response.text}"
        data = response.json()
        assert data.get("phone_sent") == True, "Phone OTP should be sent"
        assert data.get("email_sent") == True, "Email OTP should be sent"
        print(f"✓ OTP sent successfully for phone 98765{unique_id}")
        return unique_id
    
    def test_duplicate_email_prevention(self):
        """Test signup rejects duplicate email"""
        response = requests.post(f"{BASE_URL}/api/otp/send", json={
            "phone_number": "1111111111",  # New phone
            "country_code": "+91",
            "email": "admin@f3fitness.com"  # Existing email
        })
        assert response.status_code == 400, f"Should reject duplicate email: {response.text}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower(), f"Error message should mention already registered: {data}"
        print("✓ Duplicate email correctly rejected")
    
    def test_duplicate_phone_prevention(self):
        """Test signup rejects duplicate phone number"""
        response = requests.post(f"{BASE_URL}/api/otp/send", json={
            "phone_number": "9999999999",  # Admin's phone
            "country_code": "+91",
            "email": "brandnew@test.com"
        })
        assert response.status_code == 400, f"Should reject duplicate phone: {response.text}"
        data = response.json()
        assert "already registered" in data.get("detail", "").lower(), f"Error message should mention already registered: {data}"
        print("✓ Duplicate phone correctly rejected")
    
    def test_complete_signup_flow_e2e(self):
        """Test complete E2E signup: Send OTP → Verify OTP → Create Account → Auto-Login"""
        unique_id = generate_unique_id()
        phone = f"55555{unique_id}"
        email = f"e2e_test_{unique_id}@test.com"
        
        # Step 1: Send OTP
        send_response = requests.post(f"{BASE_URL}/api/otp/send", json={
            "phone_number": phone,
            "country_code": "+91",
            "email": email
        })
        assert send_response.status_code == 200, f"OTP send failed: {send_response.text}"
        print(f"✓ Step 1: OTP sent to {phone}")
        
        # Step 2: Get OTP from MongoDB
        client = get_mongo_client()
        db = client[DB_NAME]
        otp_doc = db.otps.find_one({"phone_number": phone})
        assert otp_doc is not None, "OTP not found in database"
        otp = otp_doc["otp"]
        print(f"✓ Step 2: OTP retrieved from DB: {otp}")
        
        # Step 3: Verify OTP
        verify_response = requests.post(f"{BASE_URL}/api/otp/verify", json={
            "phone_number": phone,
            "country_code": "+91",
            "phone_otp": otp,
            "email": email,
            "email_otp": otp
        })
        assert verify_response.status_code == 200, f"OTP verify failed: {verify_response.text}"
        data = verify_response.json()
        assert data.get("verified") == True, "OTP should be verified"
        print("✓ Step 3: OTP verified successfully")
        
        # Step 4: Signup with verified OTP
        signup_response = requests.post(f"{BASE_URL}/api/auth/signup-with-otp", json={
            "name": f"E2E Test User {unique_id}",
            "email": email,
            "phone_number": phone,
            "country_code": "+91",
            "password": "testpass123",
            "gender": "male",
            "date_of_birth": "1995-06-15",
            "phone_otp": otp,
            "email_otp": otp
        })
        assert signup_response.status_code == 200, f"Signup failed: {signup_response.text}"
        data = signup_response.json()
        assert "token" in data, "Token should be returned after signup"
        assert "user" in data, "User data should be returned"
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "member"
        print(f"✓ Step 4: Account created successfully - Member ID: {data['user']['member_id']}")
        
        # Step 5: Verify auto-login by using returned token
        token = data["token"]
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_response.status_code == 200, f"Auth/me failed: {me_response.text}"
        me_data = me_response.json()
        assert me_data["email"] == email, "Should be logged in as the new user"
        print("✓ Step 5: Auto-login verified - Token works correctly")
        
        client.close()
        return {"token": token, "user": data["user"]}


class TestForgotPasswordFlow:
    """Test Forgot Password Flow"""
    
    def test_forgot_password_send_otp(self):
        """Test forgot password sends OTP"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "context_test@example.com"
        })
        assert response.status_code == 200, f"Forgot password failed: {response.text}"
        data = response.json()
        assert "message" in data
        print("✓ Forgot password OTP sent successfully")
    
    def test_forgot_password_nonexistent_email(self):
        """Test forgot password with non-existent email (should not reveal if email exists)"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "nonexistent@example.com"
        })
        # Should return 200 for security reasons (don't reveal if email exists)
        assert response.status_code == 200, f"Should return 200: {response.text}"
        print("✓ Forgot password for non-existent email handled securely")
    
    def test_reset_password_complete_flow(self):
        """Test complete password reset flow"""
        # Step 1: Request reset OTP
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "context_test@example.com"
        })
        assert response.status_code == 200
        
        # Step 2: Get OTP from MongoDB
        client = get_mongo_client()
        db = client[DB_NAME]
        reset_doc = db.password_resets.find_one({"used": False}, sort=[("expires_at", -1)])
        
        if reset_doc:
            otp = reset_doc["otp"]
            print(f"✓ Reset OTP retrieved: {otp}")
            
            # Step 3: Reset password (using same password for test continuity)
            reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
                "otp": otp,
                "new_password": "testpass123"  # Keep same password for other tests
            })
            assert reset_response.status_code == 200, f"Reset failed: {reset_response.text}"
            print("✓ Password reset completed successfully")
        else:
            print("⚠ No reset document found - skipping reset verification")
        
        client.close()


class TestProfileAndChangePassword:
    """Test Profile Update and Change Password functionality"""
    
    @pytest.fixture
    def member_token(self):
        """Get authenticated member token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=MEMBER_CREDS)
        assert response.status_code == 200
        return response.json()["token"], response.json()["user"]
    
    @pytest.fixture
    def admin_token(self):
        """Get authenticated admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200
        return response.json()["token"], response.json()["user"]
    
    def test_get_current_user_profile(self, member_token):
        """Test getting current user profile"""
        token, user = member_token
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Failed to get profile: {response.text}"
        data = response.json()
        assert data["email"] == "context_test@example.com"
        print(f"✓ Profile fetched - Name: {data['name']}, Member ID: {data['member_id']}")
    
    def test_update_profile_info(self, member_token):
        """Test updating profile information"""
        token, user = member_token
        response = requests.put(f"{BASE_URL}/api/users/{user['id']}", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Context Test Updated",
                "gender": "male",
                "city": "Jaipur",
                "zip_code": "302001"
            }
        )
        assert response.status_code == 200, f"Failed to update profile: {response.text}"
        data = response.json()
        assert data["name"] == "Context Test Updated"
        assert data["city"] == "Jaipur"
        print("✓ Profile updated successfully")
        
        # Reset name for other tests
        requests.put(f"{BASE_URL}/api/users/{user['id']}", 
            headers={"Authorization": f"Bearer {token}"},
            json={"name": "Context Test"}
        )
    
    def test_change_password(self, member_token):
        """Test change password functionality"""
        token, user = member_token
        
        # Change to new password
        response = requests.post(f"{BASE_URL}/api/users/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "testpass123",
                "new_password": "newpassword456"
            }
        )
        assert response.status_code == 200, f"Failed to change password: {response.text}"
        print("✓ Password changed to newpassword456")
        
        # Verify old password no longer works
        old_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "context_test@example.com",
            "password": "testpass123"
        })
        assert old_login.status_code == 401, "Old password should not work"
        print("✓ Old password correctly rejected")
        
        # Verify new password works
        new_login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "context_test@example.com",
            "password": "newpassword456"
        })
        assert new_login.status_code == 200, "New password should work"
        print("✓ New password works correctly")
        
        # Restore original password for other tests
        new_token = new_login.json()["token"]
        restore = requests.post(f"{BASE_URL}/api/users/change-password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={
                "current_password": "newpassword456",
                "new_password": "testpass123"
            }
        )
        assert restore.status_code == 200, "Failed to restore password"
        print("✓ Password restored to original for other tests")
    
    def test_change_password_wrong_current(self, member_token):
        """Test change password fails with wrong current password"""
        token, user = member_token
        response = requests.post(f"{BASE_URL}/api/users/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword456"
            }
        )
        assert response.status_code == 400, f"Should reject wrong password: {response.text}"
        print("✓ Wrong current password correctly rejected")


class TestDashboardStats:
    """Test Dashboard APIs for Admin and Member"""
    
    def test_admin_dashboard_stats(self):
        """Test admin dashboard stats API"""
        # Login as admin
        login = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        token = login.json()["token"]
        
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Dashboard stats failed: {response.text}"
        data = response.json()
        
        # Check all required fields
        assert "total_members" in data, "Missing total_members"
        assert "active_memberships" in data, "Missing active_memberships"
        assert "today_collection" in data, "Missing today_collection"
        assert "present_today" in data, "Missing present_today"
        assert "absent_today" in data, "Missing absent_today"
        assert "today_birthdays" in data, "Missing today_birthdays"
        assert "upcoming_birthdays" in data, "Missing upcoming_birthdays"
        assert "upcoming_renewals" in data, "Missing upcoming_renewals"
        assert "regular_absentees" in data, "Missing regular_absentees"
        
        print(f"✓ Admin Dashboard Stats: {data['total_members']} members, {data['active_memberships']} active")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
