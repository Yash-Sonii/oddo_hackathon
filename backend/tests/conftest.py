"""Pytest fixtures: isolated in-memory database, test client, and auth helpers."""
import pytest
from werkzeug.security import generate_password_hash
from flask_jwt_extended import create_access_token

import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import create_app
from app.extensions import db as _db
from app.models import Employee, Department, AssetCategory


@pytest.fixture(scope="session")
def app():
    """Create a Flask app configured for testing with an in-memory SQLite DB."""
    test_config = {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret-key",
    }
    _app = create_app(config_overrides=test_config)
    yield _app


@pytest.fixture(scope="function")
def db(app):
    """Provide a clean database for every single test function."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app, db):
    """Flask test client bound to a fresh database."""
    return app.test_client()


# ── Helper: seed a user and return (employee_obj, jwt_headers) ──────────
def _make_user(db, name, email, password, role, status="active", dept_id=None):
    emp = Employee(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        status=status,
        department_id=dept_id,
    )
    db.session.add(emp)
    db.session.commit()
    return emp


def _auth_headers(app, emp):
    with app.app_context():
        token = create_access_token(
            identity=str(emp.id), additional_claims={"role": emp.role}
        )
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture()
def admin_user(app, db):
    emp = _make_user(db, "Admin User", "admin@test.com", "password123", "admin")
    return emp, _auth_headers(app, emp)


@pytest.fixture()
def employee_user(app, db):
    emp = _make_user(db, "Employee User", "emp@test.com", "password123", "employee")
    return emp, _auth_headers(app, emp)


@pytest.fixture()
def asset_manager_user(app, db):
    emp = _make_user(db, "AM User", "am@test.com", "password123", "asset_manager")
    return emp, _auth_headers(app, emp)


@pytest.fixture()
def seed_category(db):
    """Return a single AssetCategory so asset registration can reference it."""
    cat = AssetCategory(name="Laptops")
    db.session.add(cat)
    db.session.commit()
    return cat


@pytest.fixture()
def seed_department(db):
    dept = Department(name="Engineering", code="ENG", status="active")
    db.session.add(dept)
    db.session.commit()
    return dept
