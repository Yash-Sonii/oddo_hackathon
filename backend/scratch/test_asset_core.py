import sys
import os
from datetime import date, datetime

# Add parent directory to path so imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import Asset, AssetCategory, Employee, Allocation, MaintenanceRequest, Department
from flask_jwt_extended import create_access_token
from app.services.asset_lifecycle import (
    change_asset_status,
    AssetNotFoundError,
    InvalidStatusTransitionError
)

app = create_app()

def run_tests():
    print("Initializing test database...")
    with app.app_context():
        db.drop_all()
        db.create_all()

        # Seed initial data
        # 1. Departments
        dept1 = Department(name="Engineering", code="ENG")
        dept2 = Department(name="Marketing", code="MKT")
        db.session.add_all([dept1, dept2])
        db.session.commit()
        dept1_id = dept1.id
        dept2_id = dept2.id

        # 2. Category
        cat_laptops = AssetCategory(name="Laptops")
        cat_phones = AssetCategory(name="Phones")
        db.session.add_all([cat_laptops, cat_phones])
        db.session.commit()
        cat_laptops_id = cat_laptops.id
        cat_phones_id = cat_phones.id

        # 3. Employee (Admin) for auth
        admin_emp = Employee(
            name="Admin User",
            email="admin@example.com",
            password_hash="mock-hash",
            role="admin",
            status="active"
        )
        employee_user = Employee(
            name="Regular Emp",
            email="emp@example.com",
            password_hash="mock-hash",
            role="employee",
            status="active"
        )
        db.session.add_all([admin_emp, employee_user])
        db.session.commit()
        admin_emp_id = admin_emp.id
        employee_user_id = employee_user.id

        # Generate JWT Token for admin
        token = create_access_token(identity=str(admin_emp_id), additional_claims={"role": "admin"})
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

    client = app.test_client()

    print("\n================== BACKEND SPEC TEST SUITE ==================\n")

    # ------------------ TEST 1: POST /api/assets ------------------
    print("Testing 1: POST /api/assets (Asset Registration)...")
    
    # Check category validation (missing)
    resp = client.post("/api/assets", json={"name": "MacBook Pro"}, headers=headers)
    print(f"  - Missing category_id response: {resp.status_code} {resp.json}")
    assert resp.status_code == 400
    assert "Category ID is required" in resp.json.get("error", "")

    # Check category validation (non-existent category_id)
    resp = client.post("/api/assets", json={"name": "MacBook Pro", "category_id": 999}, headers=headers)
    print(f"  - Non-existent category_id response: {resp.status_code} {resp.json}")
    assert resp.status_code == 400
    assert "does not exist" in resp.json.get("error", "")

    # Check asset name validation
    resp = client.post("/api/assets", json={"category_id": cat_laptops_id}, headers=headers)
    print(f"  - Missing name response: {resp.status_code} {resp.json}")
    assert resp.status_code == 400

    # Create first asset (AF-0001)
    resp = client.post("/api/assets", json={
        "name": "MacBook Pro M3",
        "category_id": cat_laptops_id,
        "serial_number": "SN-MAC001",
        "acquisition_date": "2026-01-01",
        "acquisition_cost": 2499.99,
        "condition": "New",
        "location": "HQ Room 101",
        "is_bookable": True,
        "photo_url": "http://example.com/mac.jpg"
    }, headers=headers)
    print(f"  - Create asset 1 response: {resp.status_code} {resp.json}")
    assert resp.status_code == 201
    assert resp.json["asset_tag"] == "AF-0001"
    assert resp.json["status"] == "available"
    assert resp.json["photo_url"] == "http://example.com/mac.jpg"
    asset1_id = resp.json["id"]

    # Create second asset (AF-0002)
    resp = client.post("/api/assets", json={
        "name": "iPhone 15",
        "category_id": cat_phones_id,
        "serial_number": "SN-IPH002",
        "acquisition_date": "2026-02-01",
        "acquisition_cost": 999.00,
        "condition": "Excellent",
        "location": "HQ Room 102",
        "is_bookable": False
    }, headers=headers)
    print(f"  - Create asset 2 response: {resp.status_code} {resp.json}")
    assert resp.status_code == 201
    assert resp.json["asset_tag"] == "AF-0002"
    asset2_id = resp.json["id"]

    print("  PASS: POST /api/assets (category checks, tag generation, defaults, photo/doc support)")


    # ------------------ TEST 2: GET /api/assets (Filters) ------------------
    print("\nTesting 2: GET /api/assets (Filters)...")
    
    # Filter by tag
    resp = client.get(f"/api/assets?tag=AF-0001", headers=headers)
    print(f"  - Filter tag=AF-0001: found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "MacBook Pro M3"

    # Filter by serial_number
    resp = client.get(f"/api/assets?serial_number=SN-IPH002", headers=headers)
    print(f"  - Filter serial_number=SN-IPH002: found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "iPhone 15"

    # Filter by category_id
    resp = client.get(f"/api/assets?category_id={cat_laptops_id}", headers=headers)
    print(f"  - Filter category_id={cat_laptops_id}: found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "MacBook Pro M3"

    # Filter by status
    resp = client.get(f"/api/assets?status=available", headers=headers)
    print(f"  - Filter status=available: found {len(resp.json)} items")
    assert len(resp.json) == 2

    # Filter by location
    resp = client.get(f"/api/assets?location=HQ Room 101", headers=headers)
    print(f"  - Filter location='HQ Room 101': found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "MacBook Pro M3"

    # Seed an allocation for department filter test
    with app.app_context():
        alloc = Allocation(
            asset_id=asset1_id,
            employee_id=employee_user_id,
            department_id=dept1_id,
            allocated_date=date(2026, 1, 1),
            status="active"
        )
        db.session.add(alloc)
        db.session.commit()

    # Filter by department_id
    resp = client.get(f"/api/assets?department_id={dept1_id}", headers=headers)
    print(f"  - Filter department_id={dept1_id}: found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "MacBook Pro M3"

    # Filter combined (tag + status + location)
    resp = client.get(f"/api/assets?tag=AF-0001&status=available&location=HQ Room 101", headers=headers)
    print(f"  - Filter tag=AF-0001 & status=available & location=HQ Room 101: found {len(resp.json)} items")
    assert len(resp.json) == 1 and resp.json[0]["name"] == "MacBook Pro M3"

    # Filter combined invalid
    resp = client.get(f"/api/assets?tag=AF-0002&location=HQ Room 101", headers=headers)
    print(f"  - Filter tag=AF-0002 & location=HQ Room 101: found {len(resp.json)} items")
    assert len(resp.json) == 0

    print("  PASS: GET /api/assets (all filters singly and combined)")


    # ------------------ TEST 3: GET /api/assets/<id> (Detail & Histories) ------------------
    print("\nTesting 3: GET /api/assets/<id> (Detail & Histories)...")
    
    # Asset 2: no allocations, no maintenance
    resp = client.get(f"/api/assets/{asset2_id}", headers=headers)
    print(f"  - Detail asset 2 response: {resp.status_code}")
    assert resp.status_code == 200
    assert resp.json["name"] == "iPhone 15"
    assert resp.json["allocation_history"] == []
    assert resp.json["maintenance_history"] == []

    # Asset 1: has 1 allocation, let's add 2 maintenance requests to verify sorting
    with app.app_context():
        m1 = MaintenanceRequest(
            asset_id=asset1_id,
            raised_by_employee_id=employee_user_id,
            issue_description="Screen flicker",
            priority="Medium",
            status="pending",
            created_at=datetime(2026, 1, 1, 10, 0, 0)
        )
        m2 = MaintenanceRequest(
            asset_id=asset1_id,
            raised_by_employee_id=employee_user_id,
            issue_description="Keyboard stuck",
            priority="High",
            status="in_progress",
            created_at=datetime(2026, 1, 2, 11, 0, 0) # newer request
        )
        db.session.add_all([m1, m2])
        db.session.commit()

    resp = client.get(f"/api/assets/{asset1_id}", headers=headers)
    print(f"  - Detail asset 1 response: {resp.status_code}")
    assert resp.status_code == 200
    assert len(resp.json["allocation_history"]) == 1
    assert len(resp.json["maintenance_history"]) == 2
    # Verify maintenance history is date desc (newest first)
    assert resp.json["maintenance_history"][0]["issue_description"] == "Keyboard stuck"
    assert resp.json["maintenance_history"][1]["issue_description"] == "Screen flicker"

    print("  PASS: GET /api/assets/<id> (returns history sub-lists, date desc, fallback empty array)")


    # ------------------ TEST 4: change_asset_status & HTTP Status Transitions ------------------
    print("\nTesting 4: Status Transitions (asset_lifecycle.py & API rejects)...")
    
    # Reset asset status to available
    with app.app_context():
        ast = Asset.query.get(asset1_id)
        ast.status = "available"
        db.session.commit()

    # Valid transitions:
    # available -> under_maintenance
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "under_maintenance"}, headers=headers)
    print(f"  - Transition available -> under_maintenance: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "under_maintenance"

    # under_maintenance -> available
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "available"}, headers=headers)
    print(f"  - Transition under_maintenance -> available: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "available"

    # available -> allocated
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "allocated"}, headers=headers)
    print(f"  - Transition available -> allocated: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "allocated"

    # allocated -> available
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "available"}, headers=headers)
    print(f"  - Transition allocated -> available: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "available"

    # available -> reserved
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "reserved"}, headers=headers)
    print(f"  - Transition available -> reserved: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "reserved"

    # reserved -> available
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "available"}, headers=headers)
    print(f"  - Transition reserved -> available: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "available"

    # Any status -> retired
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "retired"}, headers=headers)
    print(f"  - Transition available -> retired: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "retired"

    # retired -> disposed
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "disposed"}, headers=headers)
    print(f"  - Transition retired -> disposed: {resp.status_code} {resp.json.get('status')}")
    assert resp.status_code == 200 and resp.json["status"] == "disposed"

    # Invalid transitions (must block with 409):
    # 1. retired -> allocated (disposed currently, let's set back to retired)
    with app.app_context():
        ast = Asset.query.get(asset1_id)
        ast.status = "retired"
        db.session.commit()
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "allocated"}, headers=headers)
    print(f"  - Invalid Transition retired -> allocated: {resp.status_code} {resp.json}")
    assert resp.status_code == 409

    # 2. disposed -> available
    with app.app_context():
        ast = Asset.query.get(asset1_id)
        ast.status = "disposed"
        db.session.commit()
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "available"}, headers=headers)
    print(f"  - Invalid Transition disposed -> available: {resp.status_code} {resp.json}")
    assert resp.status_code == 409

    # 3. lost -> allocated
    with app.app_context():
        ast = Asset.query.get(asset1_id)
        ast.status = "lost"
        db.session.commit()
    resp = client.patch(f"/api/assets/{asset1_id}/status", json={"status": "allocated"}, headers=headers)
    print(f"  - Invalid Transition lost -> allocated: {resp.status_code} {resp.json}")
    assert resp.status_code == 409

    print("  PASS: change_asset_status enforces correct transitions and blocks invalid ones with 409 Conflict")


    # ------------------ TEST 5: Clean Import check ------------------
    print("\nTesting 5: Verify clean import from separate module...")
    try:
        from app.routes.org_setup import org_bp
        # Ensure change_asset_status is importable
        from app.services.asset_lifecycle import change_asset_status as test_import
        print("  Import successful!")
        assert test_import is not None
    except Exception as e:
        print(f"  Import failed: {e}")
        raise e

    print("  PASS: change_asset_status is cleanly importable from other routes/blueprints")

    print("\nAll backend spec tests completed successfully!")

if __name__ == "__main__":
    run_tests()
