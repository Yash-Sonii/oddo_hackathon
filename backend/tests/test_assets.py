"""Tests for Asset CRUD: registration, role enforcement, listing."""


class TestAssetRegistration:
    def test_create_asset_as_admin(self, client, admin_user, seed_category):
        _, headers = admin_user
        resp = client.post("/api/assets", json={
            "name": "MacBook Pro M3",
            "category_id": seed_category.id,
            "serial_number": "SN-001",
            "location": "HQ Floor 2",
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["name"] == "MacBook Pro M3"
        assert data["asset_tag"].startswith("AF-")
        assert data["status"] == "available"

    def test_create_asset_as_employee_forbidden(self, client, employee_user, seed_category):
        _, headers = employee_user
        resp = client.post("/api/assets", json={
            "name": "Forbidden Asset",
            "category_id": seed_category.id,
        }, headers=headers)
        assert resp.status_code == 403

    def test_create_asset_unauthenticated(self, client):
        resp = client.post("/api/assets", json={"name": "No Auth"})
        assert resp.status_code == 401

    def test_create_asset_missing_name(self, client, admin_user, seed_category):
        _, headers = admin_user
        resp = client.post("/api/assets", json={
            "category_id": seed_category.id,
        }, headers=headers)
        assert resp.status_code == 400

    def test_create_asset_missing_category(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/assets", json={
            "name": "No Cat Asset",
        }, headers=headers)
        assert resp.status_code == 400

    def test_create_asset_invalid_category(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/assets", json={
            "name": "Bad Cat Asset",
            "category_id": 9999,
        }, headers=headers)
        assert resp.status_code == 400

    def test_asset_tag_auto_increment(self, client, admin_user, seed_category):
        _, headers = admin_user
        r1 = client.post("/api/assets", json={
            "name": "Asset 1", "category_id": seed_category.id,
        }, headers=headers)
        r2 = client.post("/api/assets", json={
            "name": "Asset 2", "category_id": seed_category.id,
        }, headers=headers)
        tag1 = r1.get_json()["asset_tag"]
        tag2 = r2.get_json()["asset_tag"]
        assert tag1 != tag2
        # Verify numeric part incremented
        num1 = int(tag1.split("-")[1])
        num2 = int(tag2.split("-")[1])
        assert num2 == num1 + 1


class TestAssetListing:
    def test_list_assets_as_employee(self, client, admin_user, employee_user, seed_category):
        _, admin_h = admin_user
        # Create an asset
        client.post("/api/assets", json={
            "name": "Visible Asset", "category_id": seed_category.id,
        }, headers=admin_h)

        _, emp_h = employee_user
        resp = client.get("/api/assets", headers=emp_h)
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1

    def test_list_assets_unauthenticated(self, client):
        resp = client.get("/api/assets")
        assert resp.status_code == 401

    def test_filter_by_status(self, client, admin_user, seed_category):
        _, headers = admin_user
        client.post("/api/assets", json={
            "name": "Available Asset", "category_id": seed_category.id,
        }, headers=headers)
        resp = client.get("/api/assets?status=available", headers=headers)
        assert resp.status_code == 200
        for a in resp.get_json():
            assert a["status"] == "available"

    def test_get_single_asset(self, client, admin_user, seed_category):
        _, headers = admin_user
        created = client.post("/api/assets", json={
            "name": "Single Asset", "category_id": seed_category.id,
        }, headers=headers)
        asset_id = created.get_json()["id"]
        resp = client.get(f"/api/assets/{asset_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["name"] == "Single Asset"
        # Should include history sub-lists
        assert "allocation_history" in resp.get_json()
        assert "maintenance_history" in resp.get_json()

    def test_get_nonexistent_asset(self, client, admin_user):
        _, headers = admin_user
        resp = client.get("/api/assets/99999", headers=headers)
        assert resp.status_code == 404
