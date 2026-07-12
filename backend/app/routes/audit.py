<<<<<<< HEAD
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from datetime import datetime
from ..extensions import db
from ..models import AuditCycle, AuditAssignment, AuditRecord, Asset, Allocation, Employee, Notification
from .auth import role_required
from ..services.activity import log_activity
from ..services.notification import create_notification

audit_bp = Blueprint("audit", __name__)

def get_assets_in_scope(scope_dept_id, scope_loc):
    """
    Helper to fetch assets in scope based on department and location.
    """
    query = Asset.query
    if scope_dept_id:
        query = query.join(Allocation, Allocation.asset_id == Asset.id).filter(
            Allocation.department_id == scope_dept_id,
            Allocation.status == "active"
        )
    if scope_loc:
        query = query.filter(Asset.location.ilike(f"%{scope_loc}%"))
    return query.all()

=======
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
>>>>>>> main

@audit_bp.post("/cycles")
@role_required("admin", "asset_manager")
def create_cycle():
<<<<<<< HEAD
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    dept_id = data.get("scope_department_id")
    location = data.get("scope_location")
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")

    if not start_date_str or not end_date_str:
        return jsonify({"error": "bad_request", "message": "start_date and end_date are required"}), 400

    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        end_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
    except ValueError:
        return jsonify({"error": "bad_request", "message": "Invalid date format. Use YYYY-MM-DD"}), 400

    cycle = AuditCycle(
        scope_department_id=dept_id,
        scope_location=location,
=======
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
>>>>>>> main
        start_date=start_date,
        end_date=end_date,
        status="open"
    )
<<<<<<< HEAD

    db.session.add(cycle)
    db.session.commit()

    # Log activity
    log_activity(
        employee_id=current_user_id,
        action="audit_started",
        details=f"Created audit cycle #{cycle.id} (Dept ID: {dept_id}, Location: {location})"
    )

    # Automatically notify assigned auditors or managers
    # Find active managers to notify
    managers = Employee.query.filter(Employee.role.in_(["admin", "asset_manager"])).all()
    for mgr in managers:
        create_notification(
            mgr.id,
            f"New audit cycle #{cycle.id} has been created for department {dept_id or 'All'} / location {location or 'All'}.",
            "upcoming_audit"
        )

    return jsonify(cycle.to_dict()), 201


@audit_bp.get("/cycles")
@jwt_required()
def list_cycles():
    cycles = AuditCycle.query.all()
    out = []

    for c in cycles:
        assets = get_assets_in_scope(c.scope_department_id, c.scope_location)
        total_assets = len(assets)
        
        # Count recorded assets in this cycle
        audited_count = AuditRecord.query.filter_by(audit_cycle_id=c.id).count()
        
        pct = 100.0
        if total_assets > 0:
            pct = round((audited_count / total_assets) * 100, 2)

        # Get department name
        dept_name = None
        if c.scope_department_id:
            from ..models import Department
            dept = Department.query.get(c.scope_department_id)
            if dept:
                dept_name = dept.name

        d = c.to_dict()
        d["total_assets"] = total_assets
        d["audited_assets"] = audited_count
        d["completion_percentage"] = pct
        d["department_name"] = dept_name
        out.append(d)

    return jsonify(out)


@audit_bp.get("/cycles/<int:cycle_id>")
@jwt_required()
def get_cycle(cycle_id):
    cycle = AuditCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"error": "not_found", "message": "Audit cycle not found"}), 404

    # Fetch auditors
    assignments = db.session.query(AuditAssignment, Employee).join(
        Employee, AuditAssignment.auditor_employee_id == Employee.id
    ).filter(AuditAssignment.audit_cycle_id == cycle_id).all()
    
    auditors = []
    for ass, emp in assignments:
        auditors.append({
            "assignment_id": ass.id,
            "employee_id": emp.id,
            "name": emp.name,
            "email": emp.email
        })

    # Fetch assets in scope
    assets = get_assets_in_scope(cycle.scope_department_id, cycle.scope_location)
    
    # Fetch existing audit records for this cycle
    records = AuditRecord.query.filter_by(audit_cycle_id=cycle_id).all()
    records_map = {r.asset_id: r for r in records}

    assets_out = []
    for a in assets:
        record = records_map.get(a.id)
        assets_out.append({
            "asset": a.to_dict(),
            "is_audited": record is not None,
            "result": record.result if record else None,
            "notes": record.notes if record else None,
            "audit_record_id": record.id if record else None
        })

    d = cycle.to_dict()
    d["auditors"] = auditors
    d["assets_in_scope"] = assets_out
    d["completion_percentage"] = round((len(records) / len(assets)) * 100, 2) if len(assets) > 0 else 100.0

    return jsonify(d)


@audit_bp.post("/cycles/<int:cycle_id>/assignees")
@role_required("admin", "asset_manager")
def assign_auditor(cycle_id):
    current_user_id = int(get_jwt_identity())
    cycle = AuditCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"error": "not_found", "message": "Audit cycle not found"}), 404

    data = request.get_json() or {}
    auditor_id = data.get("auditor_employee_id")
    if not auditor_id:
        return jsonify({"error": "bad_request", "message": "auditor_employee_id is required"}), 400

    employee = Employee.query.get(auditor_id)
    if not employee:
        return jsonify({"error": "not_found", "message": "Employee not found"}), 404

    # Prevent duplicate assignment
    existing = AuditAssignment.query.filter_by(audit_cycle_id=cycle_id, auditor_employee_id=auditor_id).first()
    if existing:
        return jsonify({"message": "Auditor already assigned"}), 200

    ass = AuditAssignment(audit_cycle_id=cycle_id, auditor_employee_id=auditor_id)
    db.session.add(ass)
    db.session.commit()

    # Log and notify
    log_activity(
        employee_id=current_user_id,
        action="auditor_assigned",
        details=f"Assigned Auditor '{employee.name}' to Audit Cycle #{cycle_id}"
    )

    create_notification(
        auditor_id,
        f"You have been assigned as an auditor for Audit Cycle #{cycle_id}.",
        "upcoming_audit"
    )

    return jsonify(ass.to_dict()), 201


@audit_bp.post("/records")
@jwt_required()
def submit_record():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    cycle_id = data.get("audit_cycle_id")
    asset_id = data.get("asset_id")
    result = data.get("result")  # verified|missing|damaged
    notes = data.get("notes", "")

    if not cycle_id or not asset_id or not result:
        return jsonify({"error": "bad_request", "message": "audit_cycle_id, asset_id, and result are required"}), 400

    if result not in ["verified", "missing", "damaged"]:
        return jsonify({"error": "bad_request", "message": "result must be verified, missing, or damaged"}), 400

    cycle = AuditCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"error": "not_found", "message": "Audit cycle not found"}), 404

    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({"error": "not_found", "message": "Asset not found"}), 404

    # Check if auditor is assigned (or admin/manager can always record)
    claims = get_jwt_identity()
    user = Employee.query.get(current_user_id)
    if user.role not in ["admin", "asset_manager"]:
        assigned = AuditAssignment.query.filter_by(audit_cycle_id=cycle_id, auditor_employee_id=current_user_id).first()
        if not assigned:
            return jsonify({"error": "forbidden", "message": "You are not assigned as an auditor for this cycle"}), 403

    # Create or update record
    record = AuditRecord.query.filter_by(audit_cycle_id=cycle_id, asset_id=asset_id).first()
    if record:
        old_result = record.result
        record.result = result
        record.notes = notes
    else:
        old_result = None
        record = AuditRecord(
            audit_cycle_id=cycle_id,
            asset_id=asset_id,
            result=result,
            notes=notes
        )
        db.session.add(record)

    # 3. Automatically update asset condition / status based on audit result
    if result == "damaged":
        asset.condition = "damaged"
        # Wait, if damaged, let's keep status or we can set it to available/under_maintenance. Let's keep it.
    elif result == "missing":
        asset.status = "lost"
    elif result == "verified":
        if asset.status == "lost":
            asset.status = "available"  # recovered!
        if asset.condition == "damaged" and "repaired" in notes.lower():
            asset.condition = "good"

    db.session.add(asset)
    db.session.commit()

    # Log activity
    log_activity(
        employee_id=current_user_id,
        action="audit_recorded",
        details=f"Audited Asset '{asset.name}' in Cycle #{cycle_id}. Result: {result} (Notes: {notes})"
    )

    # 4. Trigger alert/notification for discrepancies: missing or damaged
    if result in ["missing", "damaged"]:
        # Notify admins and managers
        managers = Employee.query.filter(Employee.role.in_(["admin", "asset_manager"])).all()
        for mgr in managers:
            create_notification(
                mgr.id,
                f"AUDIT DISCREPANCY in Cycle #{cycle_id}: Asset '{asset.name}' ({asset.asset_tag}) was marked as '{result}'. Notes: {notes}",
                "audit_discrepancies"
            )

    return jsonify(record.to_dict()), 200


@audit_bp.get("/cycles/<int:cycle_id>/discrepancies")
@jwt_required()
def list_discrepancies(cycle_id):
    records = db.session.query(AuditRecord, Asset).join(
        Asset, AuditRecord.asset_id == Asset.id
    ).filter(
        AuditRecord.audit_cycle_id == cycle_id,
        AuditRecord.result.in_(["missing", "damaged"])
    ).all()

    out = []
    for r, asset in records:
        d = r.to_dict()
        d["asset_name"] = asset.name
        d["asset_tag"] = asset.asset_tag
        d["expected_location"] = asset.location
        d["expected_condition"] = asset.condition
        out.append(d)

    return jsonify(out)


@audit_bp.get("/history/<int:asset_id>")
@jwt_required()
def get_asset_audit_history(asset_id):
    records = db.session.query(AuditRecord, AuditCycle).join(
        AuditCycle, AuditRecord.audit_cycle_id == AuditCycle.id
    ).filter(AuditRecord.asset_id == asset_id).order_by(AuditCycle.start_date.desc()).all()

    out = []
    for r, cycle in records:
        d = r.to_dict()
        d["cycle_start_date"] = cycle.start_date.isoformat() if cycle.start_date else None
        d["cycle_end_date"] = cycle.end_date.isoformat() if cycle.end_date else None
        d["cycle_status"] = cycle.status
        out.append(d)

    return jsonify(out)


@audit_bp.post("/cycles/<int:cycle_id>/close")
@role_required("admin", "asset_manager")
def close_cycle(cycle_id):
    current_user_id = int(get_jwt_identity())
    cycle = AuditCycle.query.get(cycle_id)
    if not cycle:
        return jsonify({"error": "not_found", "message": "Audit cycle not found"}), 404

    cycle.status = "closed"
    db.session.commit()

    log_activity(
        employee_id=current_user_id,
        action="audit_completed",
        details=f"Closed and completed Audit Cycle #{cycle_id}"
    )

    # Notify managers
    managers = Employee.query.filter(Employee.role.in_(["admin", "asset_manager"])).all()
    for mgr in managers:
        create_notification(
            mgr.id,
            f"Audit cycle #{cycle_id} has been marked as CLOSED.",
            "audit_completed"
        )

    return jsonify(cycle.to_dict()), 200
=======
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
>>>>>>> main
