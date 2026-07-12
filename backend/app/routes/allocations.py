"""Allocation routes — assign assets to employees / departments, handle returns."""
from datetime import date, datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from ..extensions import db
from ..models import Allocation, Asset, Employee
from .auth import role_required
from ..services.asset_lifecycle import change_asset_status

allocations_bp = Blueprint("allocations", __name__)


# ── helpers ──────────────────────────────────────────────────────────────────

def _allocation_dict(a: Allocation) -> dict:
    asset = db.session.get(Asset, a.asset_id)
    emp   = db.session.get(Employee, a.employee_id)
    today = date.today()
    status = a.status
    if status == "active" and a.expected_return_date and a.expected_return_date < today:
        status = "overdue"
    return {
        "id": a.id,
        "asset_id": a.asset_id,
        "asset_name": asset.name if asset else None,
        "asset_tag": asset.asset_tag if asset else None,
        "employee_id": a.employee_id,
        "employee_name": emp.name if emp else None,
        "department_id": a.department_id,
        "allocated_date": a.allocated_date.isoformat() if a.allocated_date else None,
        "expected_return_date": a.expected_return_date.isoformat() if a.expected_return_date else None,
        "actual_return_date": a.actual_return_date.isoformat() if a.actual_return_date else None,
        "return_condition_notes": a.return_condition_notes,
        "status": status,
    }


def _parse_date(val) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return date.fromisoformat(str(val))
    except ValueError:
        return None


# ── endpoints ────────────────────────────────────────────────────────────────

@allocations_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_allocations():
    """List allocations. ?status=active|returned|overdue|all (default: active)"""
    status_filter = request.args.get("status", "active")
    q = Allocation.query
    if status_filter != "all":
        q = q.filter(Allocation.status == ("active" if status_filter == "overdue" else status_filter))
    rows = q.order_by(Allocation.id.desc()).all()
    result = [_allocation_dict(a) for a in rows]
    if status_filter == "overdue":
        result = [r for r in result if r["status"] == "overdue"]
    return jsonify(result)


@allocations_bp.get("/overdue")
@role_required("admin", "asset_manager", "department_head", "employee")
def overdue_allocations():
    """Active allocations whose expected_return_date < today."""
    today = date.today()
    rows = (
        Allocation.query
        .filter(
            Allocation.status == "active",
            Allocation.expected_return_date.isnot(None),
            Allocation.expected_return_date < today,
        )
        .order_by(Allocation.expected_return_date.asc())
        .all()
    )
    return jsonify([_allocation_dict(a) for a in rows])


@allocations_bp.post("")
@role_required("admin", "asset_manager", "department_head")
def create_allocation():
    """Allocate an asset. 409 if already actively allocated."""
    data = request.get_json(silent=True) or {}
    asset_id    = data.get("asset_id")
    employee_id = data.get("employee_id")
    dept_id     = data.get("department_id")
    exp_return  = _parse_date(data.get("expected_return_date"))

    if not asset_id:
        return jsonify({"error": "bad_request", "message": "asset_id required"}), 400
    if not employee_id and not dept_id:
        return jsonify({"error": "bad_request", "message": "employee_id or department_id required"}), 400

    # Conflict check
    existing = Allocation.query.filter_by(asset_id=asset_id, status="active").first()
    if existing:
        holder = db.session.get(Employee, existing.employee_id)
        return jsonify({
            "error": "already_allocated",
            "current_holder": holder.name if holder else "Unknown",
            "allocation_id": existing.id,
        }), 409

    alloc = Allocation(
        asset_id=asset_id,
        employee_id=employee_id or int(get_jwt_identity()),
        department_id=dept_id,
        allocated_date=date.today(),
        expected_return_date=exp_return,
        status="active",
    )
    db.session.add(alloc)
    try:
        change_asset_status(asset_id, "allocated")
        db.session.commit()
    except LookupError as e:
        db.session.rollback()
        return jsonify({"error": "not_found", "message": str(e)}), 404

    return jsonify(_allocation_dict(alloc)), 201


@allocations_bp.post("/<int:alloc_id>/return")
@role_required("admin", "asset_manager", "department_head", "employee")
def return_allocation(alloc_id: int):
    """Mark an allocation returned and free the asset."""
    alloc = db.session.get(Allocation, alloc_id)
    if not alloc:
        return jsonify({"error": "not_found"}), 404
    if alloc.status != "active":
        return jsonify({"error": "bad_request", "message": "Allocation is not active"}), 400

    data = request.get_json(silent=True) or {}
    alloc.actual_return_date    = date.today()
    alloc.status                = "returned"
    alloc.return_condition_notes = data.get("return_condition_notes", "")

    try:
        change_asset_status(alloc.asset_id, "available")
        db.session.commit()
    except LookupError as e:
        db.session.rollback()
        return jsonify({"error": "not_found", "message": str(e)}), 404

    return jsonify(_allocation_dict(alloc))
