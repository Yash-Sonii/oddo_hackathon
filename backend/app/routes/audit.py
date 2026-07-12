from datetime import datetime, date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from ..extensions import db
from ..models import AuditCycle, AuditAssignment, AuditRecord, Asset, Department, Employee
from .auth import role_required
from ..services.asset_lifecycle import change_asset_status

audit_bp = Blueprint("audit", __name__)

def _parse_date(val) -> date | None:
    if not val:
        return None
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val), "%Y-%m-%d").date()
    except ValueError:
        return None

@audit_bp.get("/cycles")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_cycles():
    cycles = AuditCycle.query.order_by(AuditCycle.id.desc()).all()
    out = []
    for c in cycles:
        dept = Department.query.get(c.scope_department_id) if c.scope_department_id else None
        
        # Get assignments
        assignments = AuditAssignment.query.filter_by(audit_cycle_id=c.id).all()
        auditors = []
        for a in assignments:
            emp = Employee.query.get(a.auditor_employee_id)
            if emp:
                auditors.append({"id": emp.id, "name": emp.name})
                
        # Get records count
        records_count = AuditRecord.query.filter_by(audit_cycle_id=c.id).count()
        
        out.append({
            "id": c.id,
            "scope_department_id": c.scope_department_id,
            "scope_department_name": dept.name if dept else None,
            "scope_location": c.scope_location,
            "start_date": c.start_date.isoformat() if c.start_date else None,
            "end_date": c.end_date.isoformat() if c.end_date else None,
            "status": c.status,
            "auditors": auditors,
            "records_count": records_count
        })
    return jsonify(out)

@audit_bp.post("/cycles")
@role_required("admin", "asset_manager")
def create_cycle():
    d = request.get_json(silent=True) or {}
    start_date = _parse_date(d.get("start_date"))
    end_date = _parse_date(d.get("end_date"))
    scope_department_id = d.get("scope_department_id")
    scope_location = d.get("scope_location")
    auditor_ids = d.get("auditor_ids") or []
    
    if not start_date or not end_date:
        return jsonify({"error": "bad_request", "message": "start_date and end_date required"}), 400
        
    cycle = AuditCycle(
        scope_department_id=scope_department_id,
        scope_location=scope_location,
        start_date=start_date,
        end_date=end_date,
        status="open"
    )
    db.session.add(cycle)
    db.session.commit()
    
    # Save assignments
    for aud_id in auditor_ids:
        assignment = AuditAssignment(audit_cycle_id=cycle.id, auditor_employee_id=int(aud_id))
        db.session.add(assignment)
    db.session.commit()
    
    return jsonify({
        "id": cycle.id,
        "status": cycle.status
    }), 201

@audit_bp.get("/cycles/<int:cycle_id>/records")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_records(cycle_id):
    records = AuditRecord.query.filter_by(audit_cycle_id=cycle_id).order_by(AuditRecord.id.desc()).all()
    out = []
    for r in records:
        asset = Asset.query.get(r.asset_id)
        out.append({
            "id": r.id,
            "asset_id": r.asset_id,
            "asset_name": asset.name if asset else None,
            "asset_tag": asset.asset_tag if asset else None,
            "result": r.result,
            "notes": r.notes
        })
    return jsonify(out)

@audit_bp.post("/records")
@role_required("admin", "asset_manager", "department_head", "employee")
def submit_record():
    d = request.get_json(silent=True) or {}
    audit_cycle_id = d.get("audit_cycle_id")
    asset_id = d.get("asset_id")
    result = d.get("result") # verified|missing|damaged
    notes = d.get("notes")
    
    if not audit_cycle_id or not asset_id or not result:
        return jsonify({"error": "bad_request", "message": "audit_cycle_id, asset_id, and result required"}), 400
        
    cycle = AuditCycle.query.get(audit_cycle_id)
    if not cycle or cycle.status != "open":
        return jsonify({"error": "bad_request", "message": "open audit cycle not found"}), 404
        
    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({"error": "not_found", "message": "asset not found"}), 404
        
    # Check if a record already exists in this cycle for this asset
    existing = AuditRecord.query.filter_by(audit_cycle_id=audit_cycle_id, asset_id=asset_id).first()
    if existing:
        return jsonify({"error": "conflict", "message": "asset already audited in this cycle"}), 409
        
    # Transition asset status based on result
    try:
        if result == "damaged":
            # If asset is currently allocated, return it first
            if asset.status == "allocated":
                from ..models import Allocation
                active_alloc = Allocation.query.filter_by(asset_id=asset_id, status="active").first()
                if active_alloc:
                    active_alloc.status = "returned"
                    active_alloc.actual_return_date = date.today()
                    active_alloc.return_condition_notes = "Returned due to audit damage report"
                asset.status = "available"
                db.session.commit()
            change_asset_status(asset_id, "under_maintenance")
        elif result == "missing":
            if asset.status == "allocated":
                from ..models import Allocation
                active_alloc = Allocation.query.filter_by(asset_id=asset_id, status="active").first()
                if active_alloc:
                    active_alloc.status = "returned"
                    active_alloc.actual_return_date = date.today()
                    active_alloc.return_condition_notes = "Returned due to audit missing report"
                asset.status = "available"
                db.session.commit()
            change_asset_status(asset_id, "lost")
    except Exception as e:
        # Don't fail the audit record submit if status transition fails, but log it
        print("Audit transition failed:", e)
        
    record = AuditRecord(
        audit_cycle_id=audit_cycle_id,
        asset_id=asset_id,
        result=result,
        notes=notes
    )
    db.session.add(record)
    db.session.commit()
    
    return jsonify(record.id), 201
