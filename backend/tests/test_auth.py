"""Tests for Authentication: signup, login success, login failure, inactive user."""


class TestSignup:
    def test_signup_success(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "New User",
            "email": "newuser@test.com",
            "password": "securepass"
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert "access_token" in data
        assert data["employee"]["email"] == "newuser@test.com"
        assert data["employee"]["role"] == "employee"  # hardcoded role

    def test_signup_duplicate_email(self, client):
        # First signup
        client.post("/api/auth/signup", json={
            "name": "User A", "email": "dup@test.com", "password": "password1"
        })
        # Second signup with same email
        resp = client.post("/api/auth/signup", json={
            "name": "User B", "email": "dup@test.com", "password": "password2"
        })
        assert resp.status_code == 409

    def test_signup_missing_fields(self, client):
        resp = client.post("/api/auth/signup", json={"name": "No Email"})
        assert resp.status_code == 400

    def test_signup_short_password(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Short", "email": "short@test.com", "password": "abc"
        })
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, client):
        # Signup first
        client.post("/api/auth/signup", json={
            "name": "Login User", "email": "login@test.com", "password": "password123"
        })
        # Login
        resp = client.post("/api/auth/login", json={
            "email": "login@test.com", "password": "password123"
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/auth/signup", json={
            "name": "WP User", "email": "wp@test.com", "password": "correctpw"
        })
        resp = client.post("/api/auth/login", json={
            "email": "wp@test.com", "password": "wrongpassword"
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client):
        resp = client.post("/api/auth/login", json={
            "email": "nobody@test.com", "password": "whatever"
        })
        assert resp.status_code == 401

    def test_login_inactive_user(self, client, db):
        from app.models import Employee
        from werkzeug.security import generate_password_hash
        emp = Employee(
            name="Inactive", email="inactive@test.com",
            password_hash=generate_password_hash("password123"),
            role="employee", status="inactive"
        )
        db.session.add(emp)
        db.session.commit()

        resp = client.post("/api/auth/login", json={
            "email": "inactive@test.com", "password": "password123"
        })
        assert resp.status_code == 403


class TestMe:
    def test_me_authenticated(self, client, admin_user):
        _, headers = admin_user
        resp = client.get("/api/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["email"] == "admin@test.com"

    def test_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401
