"""Auth blueprint: signup, login, forgot-password, @role_required decorator."""
from functools import wraps
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from ..extensions import db
from ..models import Employee

auth_bp = Blueprint("auth", __name__)


def role_required(*roles):
    """Decorator: require a valid JWT AND one of the given roles.

    Usage:
        @role_required('admin')
        @role_required('admin', 'asset_manager')
    """
    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            claims = get_jwt()
            role = claims.get("role")
            if role not in roles:
                return jsonify({"error": "forbidden", "message": "insufficient role"}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "bad_request", "message": "name, email, password required"}), 400
    if len(password) < 6:
        return jsonify({"error": "bad_request", "message": "password too short"}), 400
    if Employee.query.filter_by(email=email).first():
        return jsonify({"error": "conflict", "message": "email already registered"}), 409

    emp = Employee(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="employee",  # HARDCODED — never trust request body for role
        status="active",
        department_id=data.get("department_id"),
    )
    db.session.add(emp)
    db.session.commit()

    token = create_access_token(identity=str(emp.id), additional_claims={"role": emp.role})
    return jsonify({"access_token": token, "employee": emp.to_dict()}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "bad_request", "message": "email and password required"}), 400

    emp = Employee.query.filter_by(email=email).first()
    if not emp or not check_password_hash(emp.password_hash, password):
        return jsonify({"error": "unauthorized", "message": "invalid credentials"}), 401
    if emp.status != "active":
        return jsonify({"error": "forbidden", "message": "account inactive"}), 403

    token = create_access_token(identity=str(emp.id), additional_claims={"role": emp.role})
    return jsonify({"access_token": token, "employee": emp.to_dict()}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    """Mock reset flow — always returns 200 (do not leak whether email exists)."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "bad_request", "message": "email required"}), 400
    # TODO: real flow — generate token, email link
    return jsonify({"message": "If the email exists, a reset link has been sent.",
                    "mock_reset_token": "demo-token-123"}), 200


@auth_bp.get("/me")
@jwt_required()
def me():
    emp = Employee.query.get(int(get_jwt_identity()))
    if not emp:
        return jsonify({"error": "not_found"}), 404
    return jsonify(emp.to_dict())
