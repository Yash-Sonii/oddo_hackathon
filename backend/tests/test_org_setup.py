"""Tests for Org Setup: department CRUD, category CRUD, employee role changes.
All admin-only routes — verifies RBAC enforcement."""


class TestDepartmentCRUD:
    def test_create_department_as_admin(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/departments", json={
            "name": "Finance", "code": "FIN",
        }, headers=headers)
        assert resp.status_code == 201
        assert resp.get_json()["name"] == "Finance"

    def test_create_department_as_employee_forbidden(self, client, employee_user):
        _, headers = employee_user
        resp = client.post("/api/departments", json={
            "name": "Secret Dept", "code": "SEC",
        }, headers=headers)
        assert resp.status_code == 403

    def test_create_department_unauthenticated(self, client):
        resp = client.post("/api/departments", json={
            "name": "No Auth", "code": "NAU",
        })
        assert resp.status_code == 401

    def test_create_duplicate_department(self, client, admin_user):
        _, headers = admin_user
        client.post("/api/departments", json={"name": "HR", "code": "HR"}, headers=headers)
        resp = client.post("/api/departments", json={"name": "HR", "code": "HR2"}, headers=headers)
        assert resp.status_code == 409

    def test_list_departments(self, client, admin_user):
        _, headers = admin_user
        client.post("/api/departments", json={"name": "Sales", "code": "SLS"}, headers=headers)
        resp = client.get("/api/departments", headers=headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1

    def test_deactivate_department(self, client, admin_user):
        _, headers = admin_user
        created = client.post("/api/departments", json={
            "name": "TempDept", "code": "TMP",
        }, headers=headers)
        dept_id = created.get_json()["id"]
        resp = client.delete(f"/api/departments/{dept_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "inactive"


class TestCategoryCRUD:
    def test_create_category_as_admin(self, client, admin_user):
        _, headers = admin_user
        resp = client.post("/api/categories", json={"name": "Monitors"}, headers=headers)
        assert resp.status_code == 201

    def test_create_category_as_employee_forbidden(self, client, employee_user):
        _, headers = employee_user
        resp = client.post("/api/categories", json={"name": "Forbidden"}, headers=headers)
        assert resp.status_code == 403

    def test_create_duplicate_category(self, client, admin_user):
        _, headers = admin_user
        client.post("/api/categories", json={"name": "Phones"}, headers=headers)
        resp = client.post("/api/categories", json={"name": "Phones"}, headers=headers)
        assert resp.status_code == 409

    def test_list_categories(self, client, admin_user):
        _, headers = admin_user
        client.post("/api/categories", json={"name": "Tablets"}, headers=headers)
        resp = client.get("/api/categories", headers=headers)
        assert resp.status_code == 200
        assert len(resp.get_json()) >= 1


class TestEmployeeRoleChange:
    def test_promote_employee(self, client, admin_user, employee_user):
        _, admin_h = admin_user
        emp, _ = employee_user

        resp = client.patch(f"/api/employees/{emp.id}/role", json={
            "role": "department_head",
        }, headers=admin_h)
        assert resp.status_code == 200
        assert resp.get_json()["role"] == "department_head"

    def test_employee_cannot_promote(self, client, admin_user, employee_user):
        """Only admins can change roles."""
        admin_emp, _ = admin_user
        _, emp_h = employee_user

        resp = client.patch(f"/api/employees/{admin_emp.id}/role", json={
            "role": "employee",
        }, headers=emp_h)
        assert resp.status_code == 403

    def test_invalid_role_rejected(self, client, admin_user, employee_user):
        _, admin_h = admin_user
        emp, _ = employee_user
        resp = client.patch(f"/api/employees/{emp.id}/role", json={
            "role": "superadmin",
        }, headers=admin_h)
        assert resp.status_code == 400
