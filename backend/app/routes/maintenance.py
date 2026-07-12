from datetime import date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import get_jwt_identity
from ..extensions import db
from ..models import MaintenanceRequest, Asset, Employee, Allocation
from .auth import role_required
from ..services.asset_lifecycle import change_asset_status

maintenance_bp = Blueprint("maintenance", __name__)

@maintenance_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_requests():
    asset_id = request.args.get("asset_id")
    q = MaintenanceRequest.query
    if asset_id:
        try:
            q = q.filter_by(asset_id=int(asset_id))
        except ValueError:
            pass
    rows = q.order_by(MaintenanceRequest.id.desc()).all()
    
    out = []
    for r in rows:
        asset = Asset.query.get(r.asset_id)
        emp = Employee.query.get(r.raised_by_employee_id) if r.raised_by_employee_id else None
        d = r.to_dict()
        d["asset_name"] = asset.name if asset else None
        d["asset_tag"] = asset.asset_tag if asset else None
        d["raised_by_name"] = emp.name if emp else None
        out.append(d)
    return jsonify(out)

@maintenance_bp.post("")
@role_required("admin", "asset_manager", "department_head", "employee")
def create_request():
    d = request.get_json(silent=True) or {}
    asset_id = d.get("asset_id")
    issue_description = d.get("issue_description")
    priority = d.get("priority", "medium")
    
    if not asset_id or not issue_description:
        return jsonify({"error": "bad_request", "message": "asset_id and issue_description required"}), 400
    
    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({"error": "not_found", "message": "asset not found"}), 404
        
    try:
        # If the asset is currently allocated, return/deallocate it first
        if asset.status == "allocated":
            active_alloc = Allocation.query.filter_by(asset_id=asset_id, status="active").first()
            if active_alloc:
                active_alloc.status = "returned"
                active_alloc.actual_return_date = date.today()
                active_alloc.return_condition_notes = "Returned due to maintenance request: " + issue_description
            asset.status = "available"
            db.session.commit()
            
        change_asset_status(asset_id, "under_maintenance")
    except Exception as e:
        return jsonify({"error": "invalid_transition", "message": str(e)}), 400
        
    req = MaintenanceRequest(
        asset_id=asset_id,
        raised_by_employee_id=int(get_jwt_identity()),
        issue_description=issue_description,
        priority=priority,
        status="pending"
    )
    db.session.add(req)
    db.session.commit()
    return jsonify(req.to_dict()), 201

@maintenance_bp.patch("/<int:req_id>")
@role_required("admin", "asset_manager")
def update_request(req_id):
    req = MaintenanceRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "not_found"}), 404
        
    d = request.get_json(silent=True) or {}
    new_status = d.get("status")
    technician_name = d.get("technician_name")
    
    if new_status:
        req.status = new_status
        if new_status == "resolved":
            try:
                change_asset_status(req.asset_id, "available")
            except Exception:
                pass
    if technician_name is not None:
        req.technician_name = technician_name
        
    db.session.commit()
    return jsonify(req.to_dict()), 200
