"""
Test file for iteration 11 - New Features:
1. Import Existing Membership with custom dates and auto-calculation
2. Payment date field for existing members
3. User History endpoint GET /api/users/{userId}/history
4. Invoice endpoint GET /api/invoices/{paymentId}
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthCheck:
    """Health check to ensure backend is running"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ Backend health check passed")


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data
        print("✓ Admin login successful")
        return data["token"]
    
    def test_admin_login(self, admin_token):
        """Test admin can login"""
        assert admin_token is not None
        assert len(admin_token) > 0


class TestUserHistoryEndpoint:
    """Tests for GET /api/users/{userId}/history"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_member(self, auth_headers):
        """Create a test member for history testing"""
        unique_suffix = datetime.now().strftime("%Y%m%d%H%M%S")
        member_data = {
            "name": f"TEST_HistoryUser_{unique_suffix}",
            "email": f"test_history_{unique_suffix}@test.com",
            "phone_number": f"99887{unique_suffix[-5:]}",
            "password": "testpass123",
            "gender": "male"
        }
        response = requests.post(
            f"{BASE_URL}/api/users?role=member",
            json=member_data,
            headers=auth_headers
        )
        if response.status_code == 201 or response.status_code == 200:
            return response.json()
        # If member already exists, try to find them
        print(f"Member creation response: {response.status_code} - {response.text}")
        return None
    
    def test_user_history_endpoint_exists(self, auth_headers, test_member):
        """Test that user history endpoint returns valid response"""
        if not test_member:
            pytest.skip("Test member not created")
        
        user_id = test_member.get("id")
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/history",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "user" in data, "Response should contain 'user' field"
        assert "memberships" in data, "Response should contain 'memberships' field"
        assert "payments" in data, "Response should contain 'payments' field"
        assert "stats" in data, "Response should contain 'stats' field"
        
        # Validate user data
        user = data["user"]
        assert "id" in user
        assert "name" in user
        assert "member_id" in user
        
        # Validate stats
        stats = data["stats"]
        assert "total_memberships" in stats
        assert "total_payments" in stats
        assert "total_amount_paid" in stats
        assert "attendance_count" in stats
        
        print(f"✓ User history endpoint working - Stats: {stats}")
    
    def test_user_history_nonexistent_user(self, auth_headers):
        """Test that nonexistent user returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/users/nonexistent-user-id-12345/history",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ User history returns 404 for nonexistent user")


class TestCustomMembershipDates:
    """Tests for Import Existing Membership with custom dates"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_plan(self, auth_headers):
        """Get or create a test plan"""
        response = requests.get(f"{BASE_URL}/api/plans", headers=auth_headers)
        plans = response.json()
        if plans:
            return plans[0]
        # Create a plan if none exists
        plan_data = {
            "name": "TEST_Plan_30Days",
            "duration_days": 30,
            "price": 1000,
            "is_active": True
        }
        response = requests.post(f"{BASE_URL}/api/plans", json=plan_data, headers=auth_headers)
        return response.json()
    
    @pytest.fixture(scope="class")
    def test_member_for_membership(self, auth_headers):
        """Create a test member for membership testing"""
        unique_suffix = datetime.now().strftime("%Y%m%d%H%M%S%f")[:17]
        member_data = {
            "name": f"TEST_CustomMembership_{unique_suffix}",
            "email": f"test_custommem_{unique_suffix}@test.com",
            "phone_number": f"88776{unique_suffix[-5:]}",
            "password": "testpass123",
            "gender": "female"
        }
        response = requests.post(
            f"{BASE_URL}/api/users?role=member",
            json=member_data,
            headers=auth_headers
        )
        if response.status_code in [200, 201]:
            return response.json()
        return None
    
    def test_membership_with_custom_dates(self, auth_headers, test_plan, test_member_for_membership):
        """Test creating membership with custom start/end dates"""
        if not test_member_for_membership or not test_plan:
            pytest.skip("Test data not created")
        
        # Set custom dates for an "existing" membership
        custom_start = (datetime.now() - timedelta(days=15)).strftime("%Y-%m-%d")
        custom_end = (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d")
        
        payload = {
            "user_id": test_member_for_membership["id"],
            "plan_id": test_plan["id"],
            "discount_amount": 0,
            "initial_payment": 500,
            "payment_method": "cash",
            "custom_start_date": custom_start,
            "custom_end_date": custom_end
        }
        
        response = requests.post(
            f"{BASE_URL}/api/memberships",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify custom dates were used
        assert data.get("start_date", "").startswith(custom_start), f"Start date mismatch: {data.get('start_date')}"
        assert data.get("end_date", "").startswith(custom_end), f"End date mismatch: {data.get('end_date')}"
        
        print(f"✓ Membership with custom dates created: {custom_start} to {custom_end}")
    
    def test_membership_with_payment_date(self, auth_headers, test_plan):
        """Test creating membership with custom payment date"""
        # Create another member
        unique_suffix = datetime.now().strftime("%Y%m%d%H%M%S%f")[:18]
        member_data = {
            "name": f"TEST_PaymentDate_{unique_suffix}",
            "email": f"test_paydate_{unique_suffix}@test.com",
            "phone_number": f"77665{unique_suffix[-5:]}",
            "password": "testpass123"
        }
        member_resp = requests.post(
            f"{BASE_URL}/api/users?role=member",
            json=member_data,
            headers=auth_headers
        )
        
        if member_resp.status_code not in [200, 201]:
            pytest.skip("Could not create test member")
        
        member = member_resp.json()
        
        # Custom dates and payment date
        custom_start = (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d")
        custom_end = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")
        payment_date = (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d")
        
        payload = {
            "user_id": member["id"],
            "plan_id": test_plan["id"],
            "discount_amount": 100,
            "initial_payment": 900,
            "payment_method": "upi",
            "custom_start_date": custom_start,
            "custom_end_date": custom_end,
            "payment_date": payment_date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/memberships",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        print(f"✓ Membership with custom payment date created: payment_date={payment_date}")
    
    def test_membership_without_custom_dates(self, auth_headers, test_plan):
        """Test that membership without custom dates uses current date"""
        # Create member
        unique_suffix = datetime.now().strftime("%Y%m%d%H%M%S%f")[:19]
        member_data = {
            "name": f"TEST_NormalDate_{unique_suffix}",
            "email": f"test_normaldate_{unique_suffix}@test.com",
            "phone_number": f"66554{unique_suffix[-5:]}",
            "password": "testpass123"
        }
        member_resp = requests.post(
            f"{BASE_URL}/api/users?role=member",
            json=member_data,
            headers=auth_headers
        )
        
        if member_resp.status_code not in [200, 201]:
            pytest.skip("Could not create test member")
        
        member = member_resp.json()
        today = datetime.now().strftime("%Y-%m-%d")
        
        payload = {
            "user_id": member["id"],
            "plan_id": test_plan["id"],
            "discount_amount": 0,
            "initial_payment": 500,
            "payment_method": "cash"
            # No custom dates - should use current date
        }
        
        response = requests.post(
            f"{BASE_URL}/api/memberships",
            json=payload,
            headers=auth_headers
        )
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Start date should be today
        assert data.get("start_date", "").startswith(today), f"Expected start date {today}, got {data.get('start_date')}"
        print(f"✓ Membership without custom dates uses today's date: {today}")


class TestInvoiceEndpoint:
    """Tests for GET /api/invoices/{paymentId}"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_invoice_endpoint_exists(self, auth_headers):
        """Test that invoice endpoint works with valid payment"""
        # First, get some payments
        response = requests.get(f"{BASE_URL}/api/payments", headers=auth_headers)
        if response.status_code != 200:
            pytest.skip("Could not get payments")
        
        payments = response.json()
        if not payments:
            pytest.skip("No payments exist to test invoice")
        
        # Test with first payment
        payment_id = payments[0].get("id")
        invoice_response = requests.get(
            f"{BASE_URL}/api/invoices/{payment_id}",
            headers=auth_headers
        )
        
        assert invoice_response.status_code == 200, f"Expected 200, got {invoice_response.status_code}"
        invoice_data = invoice_response.json()
        
        # Validate invoice structure
        assert "invoice" in invoice_data, "Response should contain 'invoice' field"
        assert "customer" in invoice_data, "Response should contain 'customer' field"
        assert "gym" in invoice_data, "Response should contain 'gym' field"
        
        # Validate invoice details
        invoice = invoice_data["invoice"]
        assert "receipt_no" in invoice
        assert "payment_date" in invoice
        assert "amount_paid" in invoice
        assert "payment_method" in invoice
        
        # Validate customer details
        customer = invoice_data["customer"]
        assert "name" in customer
        assert "member_id" in customer
        
        print(f"✓ Invoice endpoint working - Receipt: {invoice.get('receipt_no')}, Amount: {invoice.get('amount_paid')}")
    
    def test_invoice_nonexistent_payment(self, auth_headers):
        """Test that nonexistent payment returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/invoices/nonexistent-payment-id-12345",
            headers=auth_headers
        )
        assert response.status_code == 404
        print("✓ Invoice endpoint returns 404 for nonexistent payment")


class TestAutoCalculateDates:
    """Test auto-calculation logic in frontend (backend validation)"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email_or_phone": "admin@f3fitness.com",
            "password": "admin123"
        })
        token = response.json().get("token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_plan_duration_days_available(self, auth_headers):
        """Test that plans have duration_days for auto-calculation"""
        response = requests.get(f"{BASE_URL}/api/plans", headers=auth_headers)
        assert response.status_code == 200
        
        plans = response.json()
        if not plans:
            pytest.skip("No plans to test")
        
        for plan in plans[:3]:  # Check first 3 plans
            assert "duration_days" in plan, f"Plan {plan.get('name')} missing duration_days"
            assert isinstance(plan["duration_days"], int), f"duration_days should be integer"
            assert plan["duration_days"] > 0, f"duration_days should be positive"
        
        print(f"✓ Plans have duration_days field - Sample: {plans[0].get('name')} = {plans[0].get('duration_days')} days")


# Cleanup fixture
@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    """Cleanup test data after all tests"""
    def cleanup_test_users():
        try:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email_or_phone": "admin@f3fitness.com",
                "password": "admin123"
            })
            if response.status_code != 200:
                return
            
            token = response.json().get("token")
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get all users and filter test users
            users_response = requests.get(f"{BASE_URL}/api/users?role=member", headers=headers)
            if users_response.status_code == 200:
                users = users_response.json()
                test_user_ids = [u["id"] for u in users if u.get("name", "").startswith("TEST_")]
                
                if test_user_ids:
                    requests.post(
                        f"{BASE_URL}/api/admin/users/bulk-delete",
                        json=test_user_ids,
                        headers=headers
                    )
                    print(f"\n✓ Cleaned up {len(test_user_ids)} test users")
        except Exception as e:
            print(f"Cleanup error: {e}")
    
    request.addfinalizer(cleanup_test_users)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
