"""Admin-only org setup: Departments, AssetCategories, Employee list & role promotion."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Department, AssetCategory, Employee
from .auth import role_required

org_bp = Blueprint("org", __name__)

VALID_ROLES = {"employee", "department_head", "asset_manager", "admin"}
PROMOTABLE_ROLES = {"employee", "department_head", "asset_manager"}  # admin promotion is manual


# ---------- Departments ----------
@org_bp.get("/departments")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_departments():
    return jsonify([d.to_dict() for d in Department.query.all()])


@org_bp.post("/departments")
@role_required("admin")
def create_department():
    d = request.get_json(silent=True) or {}
    name, code = (d.get("name") or "").strip(), (d.get("code") or "").strip()
    if not name or not code:
        return jsonify({"error": "bad_request", "message": "name and code required"}), 400
    if Department.query.filter((Department.name == name) | (Department.code == code)).first():
        return jsonify({"error": "conflict", "message": "name or code already exists"}), 409
    dept = Department(
        name=name, code=code,
        head_employee_id=d.get("head_employee_id"),
        parent_department_id=d.get("parent_department_id"),
        status="active",
    )
    db.session.add(dept)
    db.session.commit()
    return jsonify(dept.to_dict()), 201


@org_bp.patch("/departments/<int:dept_id>")
@role_required("admin")
def update_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "not_found"}), 404
    d = request.get_json(silent=True) or {}
    for field in ("name", "code", "head_employee_id", "parent_department_id", "status"):
        if field in d:
            setattr(dept, field, d[field])
    db.session.commit()
    return jsonify(dept.to_dict())


@org_bp.delete("/departments/<int:dept_id>")
@role_required("admin")
def deactivate_department(dept_id):
    dept = Department.query.get(dept_id)
    if not dept:
        return jsonify({"error": "not_found"}), 404
    dept.status = "inactive"
    db.session.commit()
    return jsonify(dept.to_dict())


# ---------- Asset Categories ----------
@org_bp.get("/categories")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_categories():
    return jsonify([c.to_dict() for c in AssetCategory.query.all()])


@org_bp.post("/categories")
@role_required("admin")
def create_category():
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify({"error": "bad_request", "message": "name required"}), 400
    if AssetCategory.query.filter_by(name=name).first():
        return jsonify({"error": "conflict", "message": "category exists"}), 409
    extra = d.get("extra_fields")
    if extra is not None and not isinstance(extra, dict):
        return jsonify({"error": "bad_request", "message": "extra_fields must be an object"}), 400
    cat = AssetCategory(name=name, extra_fields=extra)
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@org_bp.patch("/categories/<int:cat_id>")
@role_required("admin")
def update_category(cat_id):
    cat = AssetCategory.query.get(cat_id)
    if not cat:
        return jsonify({"error": "not_found"}), 404
    d = request.get_json(silent=True) or {}
    if "name" in d:
        cat.name = (d["name"] or "").strip()
    if "extra_fields" in d:
        if d["extra_fields"] is not None and not isinstance(d["extra_fields"], dict):
            return jsonify({"error": "bad_request", "message": "extra_fields must be object"}), 400
        cat.extra_fields = d["extra_fields"]
    db.session.commit()
    return jsonify(cat.to_dict())


# ---------- Employees ----------
@org_bp.get("/employees")
@role_required("admin", "asset_manager", "department_head")
def list_employees():
    rows = (
        db.session.query(Employee, Department)
        .outerjoin(Department, Employee.department_id == Department.id)
        .all()
    )
    out = []
    for emp, dept in rows:
        d = emp.to_dict()
        d["department_name"] = dept.name if dept else None
        out.append(d)
    return jsonify(out)


@org_bp.patch("/employees/<int:emp_id>/role")
@role_required("admin")
def change_role(emp_id):
    """The ONLY endpoint that mutates Employee.role. Admin only."""
    emp = Employee.query.get(emp_id)
    if not emp:
        return jsonify({"error": "not_found"}), 404
    d = request.get_json(silent=True) or {}
    new_role = (d.get("role") or "").strip()
    if new_role not in PROMOTABLE_ROLES:
        return jsonify({"error": "bad_request",
                        "message": f"role must be one of {sorted(PROMOTABLE_ROLES)}"}), 400
    emp.role = new_role
    db.session.commit()
    return jsonify(emp.to_dict())
