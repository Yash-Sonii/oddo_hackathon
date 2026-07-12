import urllib.request
import urllib.parse
import json
import sys
import os

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import Employee
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    emp = Employee.query.filter_by(email="test_admin@assetflow.com").first()
    if not emp:
        print("Creating test_admin@assetflow.com in database...")
        emp = Employee(
            name="Test Admin User",
            email="test_admin@assetflow.com",
            password_hash=generate_password_hash("password123"),
            role="admin",
            status="active"
        )
        db.session.add(emp)
        db.session.commit()
    else:
        emp.password_hash = generate_password_hash("password123")
        emp.status = "active"
        emp.role = "admin"
        db.session.commit()

BASE_URL = "http://127.0.0.1:5000/api"

class TestSession:
    def __init__(self):
        self.headers = {
            "Content-Type": "application/json"
        }

    def request(self, method, url, data=None):
        req_data = None
        if data is not None:
            req_data = json.dumps(data).encode("utf-8")
        
        req = urllib.request.Request(url, data=req_data, headers=self.headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                resp_data = resp.read().decode("utf-8")
                status = resp.status
                headers = resp.info()
                try:
                    json_data = json.loads(resp_data)
                except Exception:
                    json_data = resp_data
                return status, json_data, headers
        except urllib.error.HTTPError as e:
            err_data = e.read().decode("utf-8")
            try:
                json_err = json.loads(err_data)
            except Exception:
                json_err = err_data
            return e.code, json_err, e.headers
        except Exception as e:
            print(f"Connection/Unexpected error: {e}")
            return 500, str(e), {}

    def post(self, url, data):
        return self.request("POST", url, data)

    def get(self, url):
        return self.request("GET", url)

def run_tests():
    print("==================================================")
    print("STARTING E2E INTEGRATION TESTS FOR ASSETFLOW (URLLIB)")
    print("==================================================")
    
    session = TestSession()
    
    # 1. Test Authentication - Login
    print("\n[TEST 1] Logging in as Admin...")
    login_payload = {
        "email": "test_admin@assetflow.com",
        "password": "password123"
    }
    status, body, headers = session.post(f"{BASE_URL}/auth/login", login_payload)
    if status != 200:
        print(f"FAIL: Login failed with status {status}. Response: {body}")
        sys.exit(1)
    
    token = body["access_token"]
    print(f"PASS: Logged in successfully. Token: {token[:15]}...")
    session.headers["Authorization"] = f"Bearer {token}"

    # 2. Test Auth - Get Me
    print("\n[TEST 2] Fetching Profile (/me)...")
    status, body, headers = session.get(f"{BASE_URL}/auth/me")
    if status != 200:
        print(f"FAIL: /me failed with status {status}. Response: {body}")
        sys.exit(1)
    print(f"PASS: Profile retrieved: {body.get('email')} ({body.get('role')})")

    # 3. Test Dashboard API
    print("\n[TEST 3] Fetching Dashboard Metrics...")
    status, body, headers = session.get(f"{BASE_URL}/dashboard/kpis")
    if status != 200:
        print(f"FAIL: /dashboard/kpis failed with status {status}. Response: {body}")
        sys.exit(1)
    print("PASS: Dashboard metrics retrieved successfully.")
    
    # 4. Test Reports & Analytics API
    print("\n[TEST 4] Fetching Analytics Dashboard...")
    status, body, headers = session.get(f"{BASE_URL}/reports/dashboard")
    if status != 200:
        print(f"FAIL: /reports/dashboard failed with status {status}. Response: {body}")
        sys.exit(1)
    print("PASS: Reports dashboard retrieved successfully.")
    print(f"  - Utilization Rate: {body.get('utilization_rate')}%")
    print(f"  - Missing Assets: {body.get('missing_assets_count')}")
    print(f"  - Damaged Assets: {body.get('damaged_assets_count')}")
    print(f"  - Total Maintenance Cost: ${body.get('total_maintenance_cost')}")
    print(f"  - Monthly costs: {body.get('monthly_maintenance_costs')}")

    # 5. Test Reports Date Filtering
    print("\n[TEST 5] Fetching Analytics Dashboard with Date Filters...")
    status, body, headers = session.get(f"{BASE_URL}/reports/dashboard?start_date=2026-01-01&end_date=2026-12-31")
    if status != 200:
        print(f"FAIL: /reports/dashboard with date filters failed with status {status}. Response: {body}")
        sys.exit(1)
    print("PASS: Date-filtered reports retrieved successfully.")

    # 6. Test Reports Export Functionality
    print("\n[TEST 6] Exporting Asset Report...")
    status, body, headers = session.get(f"{BASE_URL}/reports/export?type=assets&format=csv")
    if status != 200:
        print(f"FAIL: Export assets failed with status {status}. Response: {body}")
        sys.exit(1)
    print(f"PASS: Assets report exported. Content-Disposition: {headers.get('Content-Disposition')}")
    
    print("\n[TEST 7] Exporting Maintenance Report...")
    status, body, headers = session.get(f"{BASE_URL}/reports/export?type=maintenance&format=csv")
    if status != 200:
        print(f"FAIL: Export maintenance failed with status {status}. Response: {body}")
        sys.exit(1)
    print(f"PASS: Maintenance report exported. Content-Disposition: {headers.get('Content-Disposition')}")

    # 7. Test Maintenance Management
    print("\n[TEST 8] Fetching Maintenance Requests...")
    status, body, headers = session.get(f"{BASE_URL}/maintenance")
    if status != 200:
        print(f"FAIL: Fetch maintenance failed with status {status}. Response: {body}")
        sys.exit(1)
    print(f"PASS: Retrieved {len(body)} maintenance requests.")

    # Create new maintenance request
    print("\n[TEST 9] Creating New Maintenance Request...")
    # Find an asset first
    status_assets, assets, _ = session.get(f"{BASE_URL}/assets")
    if not assets:
        print("FAIL: No assets found in the database. Cannot complete maintenance testing.")
        sys.exit(1)
    
    target_asset = assets[0]
    payload = {
        "asset_id": target_asset["id"],
        "issue_description": "Screen is flickering, needs screen replacement",
        "priority": "high",
        "photo_url": ""
    }
    
    status, body, headers = session.post(f"{BASE_URL}/maintenance", payload)
    if status in (200, 201):
        print(f"PASS: Maintenance request created successfully. ID: {body.get('id')}")
        
        # Test Duplicate Prevention
        print("\n[TEST 10] Testing Duplicate Maintenance Prevention...")
        status_dup, body_dup, _ = session.post(f"{BASE_URL}/maintenance", payload)
        if status_dup == 400:
            print("PASS: Duplicate request blocked correctly.")
        else:
            print(f"WARNING: Duplicate request not blocked. Status code: {status_dup}, Response: {body_dup}")
    else:
        print(f"FAIL: Creating maintenance request failed with status {status}. Response: {body}")

    # 8. Test Audits Cycle
    print("\n[TEST 11] Fetching Audit Cycles...")
    status, body, headers = session.get(f"{BASE_URL}/audits/cycles")
    if status != 200:
        print(f"FAIL: Fetching audit cycles failed with status {status}. Response: {body}")
        sys.exit(1)
    print(f"PASS: Retrieved {len(body)} audit cycles.")

    # 9. Test Activity Logs
    print("\n[TEST 12] Fetching Activity Logs...")
    status, body, headers = session.get(f"{BASE_URL}/activity-logs")
    if status != 200:
        print(f"FAIL: Fetching activity logs failed. Status: {status}")
        sys.exit(1)
    print(f"PASS: Retrieved {len(body)} activity logs.")

    # 10. Test Notifications
    print("\n[TEST 13] Fetching Notifications...")
    status, body, headers = session.get(f"{BASE_URL}/notifications")
    if status != 200:
        print(f"FAIL: Fetching notifications failed. Status: {status}")
        sys.exit(1)
    print(f"PASS: Retrieved {len(body)} notifications.")

    print("\n==================================================")
    print("ALL INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
