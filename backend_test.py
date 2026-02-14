#!/usr/bin/env python3
import requests
import sys
import json
from datetime import datetime

class F3FitnessAPITester:
    def __init__(self, base_url="https://gym-ops-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if token:
            test_headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except json.JSONDecodeError:
                    return success, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                print(f"❌ Failed - {error_msg}")
                try:
                    error_detail = response.json().get('detail', 'No detail')
                    print(f"   Error detail: {error_detail}")
                    self.errors.append(f"{name}: {error_msg} - {error_detail}")
                except:
                    self.errors.append(f"{name}: {error_msg}")
                return False, {}

        except Exception as e:
            error_msg = f"Connection/Request error: {str(e)}"
            print(f"❌ Failed - {error_msg}")
            self.errors.append(f"{name}: {error_msg}")
            return False, {}

    def test_seed_data(self):
        """Test seeding initial data"""
        return self.run_test(
            "Seed initial data",
            "POST",
            "seed",
            200
        )

    def test_admin_login(self):
        """Test admin login and store token"""
        success, response = self.run_test(
            "Admin login",
            "POST",
            "auth/login",
            200,
            data={
                "email_or_phone": "admin@f3fitness.com",
                "password": "admin123"
            }
        )
        
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_dashboard_stats(self):
        """Test dashboard stats endpoint"""
        return self.run_test(
            "Dashboard stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )

    def test_get_plans(self):
        """Test getting all plans"""
        success, response = self.run_test(
            "Get all plans",
            "GET",
            "plans",
            200
        )
        
        if success and isinstance(response, list) and len(response) > 0:
            print(f"   Found {len(response)} plans")
            return True, response
        return False, []

    def test_create_member(self):
        """Test creating a new member"""
        # Generate unique data based on current timestamp with microseconds
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        test_member_data = {
            "name": f"Test Member {timestamp}",
            "email": f"testmember_{timestamp}@example.com",
            "phone_number": f"9990{timestamp[-6:]}",  # Use last 6 digits to ensure unique
            "password": "test123",
            "gender": "male",
            "date_of_birth": "1990-01-01",
            "address": "Test Address",
            "city": "Test City",
            "zip_code": "123456"
        }
        
        success, response = self.run_test(
            "Create member",
            "POST",
            "users?role=member",
            200,  # Backend returns 200, not 201
            data=test_member_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            print(f"   Member created with ID: {response['id']}")
            print(f"   Member ID: {response.get('member_id', 'N/A')}")
            return True, response
        return False, {}

    def test_get_members(self):
        """Test getting all members"""
        return self.run_test(
            "Get all members",
            "GET",
            "users?role=member",
            200,
            token=self.admin_token
        )

    def test_mark_attendance(self, member_id):
        """Test marking attendance"""
        return self.run_test(
            "Mark attendance",
            "POST",
            "attendance",
            200,  # Backend returns 200, not 201
            data={"member_id": member_id},
            token=self.admin_token
        )

    def test_get_attendance_today(self):
        """Test getting today's attendance"""
        return self.run_test(
            "Get today's attendance",
            "GET",
            "attendance/today",
            200,
            token=self.admin_token
        )

    def test_create_plan(self):
        """Test creating a new plan"""
        test_plan_data = {
            "name": f"Test Plan {datetime.now().strftime('%H%M%S')}",
            "duration_days": 30,
            "price": 999.0,
            "is_active": True
        }
        
        return self.run_test(
            "Create plan",
            "POST",
            "plans",
            200,  # Backend returns 200, not 201
            data=test_plan_data,
            token=self.admin_token
        )

    def test_create_announcement(self):
        """Test creating announcement"""
        test_announcement_data = {
            "title": f"Test Announcement {datetime.now().strftime('%H%M%S')}",
            "content": "This is a test announcement"
        }
        
        return self.run_test(
            "Create announcement",
            "POST",
            "announcements",
            200,  # Backend returns 200, not 201
            data=test_announcement_data,
            token=self.admin_token
        )

    def test_get_announcements(self):
        """Test getting announcements"""
        return self.run_test(
            "Get announcements",
            "GET",
            "announcements",
            200
        )

    def test_member_signup(self):
        """Test member self signup"""
        # Generate unique data based on current timestamp with microseconds
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S%f')
        test_signup_data = {
            "name": f"Self Signup Member {timestamp}",
            "email": f"selfsignup_{timestamp}@example.com",
            "phone_number": f"8880{timestamp[-6:]}",  # Use last 6 digits to ensure unique
            "password": "member123",
            "gender": "female"
        }
        
        success, response = self.run_test(
            "Member self signup",
            "POST",
            "auth/signup",
            200,
            data=test_signup_data
        )
        
        if success and 'token' in response:
            self.member_token = response['token']
            print(f"   Member token obtained: {self.member_token[:20]}...")
            return True, response
        return False, {}

    def test_member_get_profile(self):
        """Test member getting their own profile"""
        return self.run_test(
            "Member get profile",
            "GET",
            "auth/me",
            200,
            token=self.member_token
        )

    def test_unauthorized_access(self):
        """Test unauthorized access to admin endpoints"""
        success, _ = self.run_test(
            "Unauthorized access to dashboard (should fail)",
            "GET",
            "dashboard/stats",
            403  # Expecting 403 Forbidden (backend returns this instead of 401)
        )
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n" + "="*60)
        print(f"📊 TEST SUMMARY")
        print(f"="*60)
        print(f"Total tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.errors:
            print(f"\n❌ ERRORS:")
            for error in self.errors:
                print(f"   • {error}")
        
        return self.tests_passed == self.tests_run

def main():
    print("🚀 Starting F3 Fitness Gym API Tests")
    print(f"Backend URL: https://gym-ops-preview.preview.emergentagent.com")
    print("="*60)
    
    tester = F3FitnessAPITester()
    
    # Test sequence
    try:
        # 1. Seed data
        tester.test_seed_data()
        
        # 2. Admin authentication
        if not tester.test_admin_login():
            print("❌ Admin login failed, stopping critical tests")
            return 1
        
        # 3. Dashboard stats
        tester.test_dashboard_stats()
        
        # 4. Plans management
        success, plans = tester.test_get_plans()
        tester.test_create_plan()
        
        # 5. Member management
        success, member_data = tester.test_create_member()
        tester.test_get_members()
        
        # 6. Attendance
        if success and 'member_id' in member_data:
            tester.test_mark_attendance(member_data['member_id'])
        tester.test_get_attendance_today()
        
        # 7. Announcements
        tester.test_create_announcement()
        tester.test_get_announcements()
        
        # 8. Member signup and profile
        tester.test_member_signup()
        if tester.member_token:
            tester.test_member_get_profile()
        
        # 9. Security test
        tester.test_unauthorized_access()
        
    except KeyboardInterrupt:
        print("\n⚠️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error during testing: {e}")
        return 1
    
    # Print summary and return result
    all_passed = tester.print_summary()
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())