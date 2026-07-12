"""Transfer-request routes — request, approve, reject asset transfers between employees."""
from datetime import date
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import TransferRequest, Allocation, Employee, Asset
from .auth import role_required
from ..services.asset_lifecycle import change_asset_status

transfers_bp = Blueprint("transfers", __name__)


# ── helpers ──────────────────────────────────────────────────────────────────

def _transfer_dict(t: TransferRequest) -> dict:
    asset      = db.session.get(Asset, t.asset_id)
    from_emp   = db.session.get(Employee, t.from_employee_id) if t.from_employee_id else None
    to_emp     = db.session.get(Employee, t.to_employee_id)   if t.to_employee_id   else None
    req_by     = db.session.get(Employee, t.requested_by)     if t.requested_by     else None
    return {
        "id": t.id,
        "asset_id": t.asset_id,
        "asset_name": asset.name if asset else None,
        "asset_tag": asset.asset_tag if asset else None,
        "from_employee_id": t.from_employee_id,
        "from_employee_name": from_emp.name if from_emp else None,
        "to_employee_id": t.to_employee_id,
        "to_employee_name": to_emp.name if to_emp else None,
        "requested_by": t.requested_by,
        "requested_by_name": req_by.name if req_by else None,
        "status": t.status,
    }


# ── endpoints ────────────────────────────────────────────────────────────────

@transfers_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_transfers():
    rows = TransferRequest.query.order_by(TransferRequest.id.desc()).all()
    return jsonify([_transfer_dict(t) for t in rows])


@transfers_bp.post("")
@role_required("admin", "asset_manager", "department_head", "employee")
def create_transfer():
    """Request a transfer. from_employee_id defaults to current holder."""
    data = request.get_json(silent=True) or {}
    asset_id       = data.get("asset_id")
    to_employee_id = data.get("to_employee_id")
    requested_by   = data.get("requested_by")

    if not asset_id or not to_employee_id:
        return jsonify({"error": "bad_request", "message": "asset_id and to_employee_id required"}), 400

    active_alloc = Allocation.query.filter_by(asset_id=asset_id, status="active").first()
    from_employee_id = active_alloc.employee_id if active_alloc else data.get("from_employee_id")

    tr = TransferRequest(
        asset_id=asset_id,
        from_employee_id=from_employee_id,
        to_employee_id=to_employee_id,
        requested_by=requested_by,
        status="requested",
    )
    db.session.add(tr)
    db.session.commit()
    return jsonify(_transfer_dict(tr)), 201


@transfers_bp.patch("/<int:tr_id>/approve")
@role_required("admin", "asset_manager", "department_head")
def approve_transfer(tr_id: int):
    """Approve: end old allocation, create new one, update asset status — atomically."""
    tr = db.session.get(TransferRequest, tr_id)
    if not tr:
        return jsonify({"error": "not_found"}), 404
    if tr.status != "requested":
        return jsonify({"error": "bad_request", "message": f"Transfer is already '{tr.status}'"}), 400

    # End existing allocation
    old_alloc = Allocation.query.filter_by(asset_id=tr.asset_id, status="active").first()
    if old_alloc:
        old_alloc.status = "returned"
        old_alloc.actual_return_date = date.today()

    # Create new allocation
    new_alloc = Allocation(
        asset_id=tr.asset_id,
        employee_id=tr.to_employee_id,
        allocated_date=date.today(),
        status="active",
    )
    db.session.add(new_alloc)

    tr.status = "completed"

    try:
        change_asset_status(tr.asset_id, "allocated")
        db.session.commit()
    except LookupError as e:
        db.session.rollback()
        return jsonify({"error": "not_found", "message": str(e)}), 404

    return jsonify(_transfer_dict(tr))


@transfers_bp.patch("/<int:tr_id>/reject")
@role_required("admin", "asset_manager", "department_head")
def reject_transfer(tr_id: int):
    tr = db.session.get(TransferRequest, tr_id)
    if not tr:
        return jsonify({"error": "not_found"}), 404
    if tr.status != "requested":
        return jsonify({"error": "bad_request", "message": f"Transfer is already '{tr.status}'"}), 400
    tr.status = "rejected"
    db.session.commit()
    return jsonify(_transfer_dict(tr))
