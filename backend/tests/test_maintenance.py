"""Tests for Maintenance Management: create, duplicate prevention, status transitions."""


def _create_asset(client, headers, seed_category):
    """Helper: register an asset and return its id."""
    resp = client.post("/api/assets", json={
        "name": "Maint Test Asset",
        "category_id": seed_category.id,
    }, headers=headers)
    return resp.get_json()["id"]


class TestCreateMaintenance:
    def test_raise_maintenance_request(self, client, admin_user, seed_category):
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)

        resp = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Keyboard not working",
            "priority": "high",
        }, headers=headers)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["status"] == "pending"
        assert data["asset_id"] == asset_id

    def test_duplicate_active_maintenance_blocked(self, client, admin_user, seed_category):
        """Cannot raise two active requests for the same asset."""
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)

        # First request — should succeed
        resp1 = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Issue 1",
        }, headers=headers)
        assert resp1.status_code == 201

        # Second request for same asset — should be blocked (409)
        resp2 = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Issue 2",
        }, headers=headers)
        assert resp2.status_code == 409

    def test_maintenance_missing_fields(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/maintenance", json={}, headers=headers)
        assert resp.status_code == 400

    def test_maintenance_nonexistent_asset(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/maintenance", json={
            "asset_id": 99999,
            "issue_description": "Ghost asset",
        }, headers=headers)
        assert resp.status_code == 404

    def test_maintenance_unauthenticated(self, client):
        resp = client.post("/api/maintenance", json={
            "asset_id": 1, "issue_description": "No auth",
        })
        assert resp.status_code == 401


class TestMaintenanceListing:
    def test_list_maintenance(self, client, admin_user, seed_category):
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)
        client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Test listing",
        }, headers=headers)

        resp = client.get("/api/maintenance", headers=headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1


class TestMaintenanceWorkflow:
    def test_approve_sets_asset_under_maintenance(self, client, admin_user, seed_category):
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)

        # Create request
        req = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Workflow test",
        }, headers=headers).get_json()

        # Approve it
        resp = client.patch(f"/api/maintenance/{req['id']}", json={
            "status": "approved",
        }, headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "approved"

        # Asset should now be under_maintenance
        asset_resp = client.get(f"/api/assets/{asset_id}", headers=headers)
        assert asset_resp.get_json()["status"] == "under_maintenance"

    def test_resolve_restores_asset_available(self, client, admin_user, seed_category):
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)

        req = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Resolve test",
        }, headers=headers).get_json()

        # Approve then resolve
        client.patch(f"/api/maintenance/{req['id']}", json={"status": "approved"}, headers=headers)
        resp = client.patch(f"/api/maintenance/{req['id']}", json={"status": "resolved"}, headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "resolved"

        # Asset should be back to available
        asset_resp = client.get(f"/api/assets/{asset_id}", headers=headers)
        assert asset_resp.get_json()["status"] == "available"


class TestMaintenanceDelete:
    def test_delete_maintenance(self, client, admin_user, seed_category):
        _, headers = admin_user
        asset_id = _create_asset(client, headers, seed_category)

        req = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Delete me",
        }, headers=headers).get_json()

        resp = client.delete(f"/api/maintenance/{req['id']}", headers=headers)
        assert resp.status_code == 200

    def test_delete_nonexistent(self, client, admin_user):
        _, headers = admin_user
        resp = client.delete("/api/maintenance/99999", headers=headers)
        assert resp.status_code == 404

    def test_employee_cannot_delete(self, client, admin_user, employee_user, seed_category):
        _, admin_h = admin_user
        _, emp_h = employee_user
        asset_id = _create_asset(client, admin_h, seed_category)

        req = client.post("/api/maintenance", json={
            "asset_id": asset_id,
            "issue_description": "Employee tries delete",
        }, headers=admin_h).get_json()

        resp = client.delete(f"/api/maintenance/{req['id']}", headers=emp_h)
        assert resp.status_code == 403
