from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
# pyrefly: ignore [missing-import]
from sqlalchemy import and_, or_
from datetime import datetime
from ..extensions import db
from ..models import MaintenanceRequest, Asset, Employee
from .auth import role_required
from ..services.activity import log_activity
from ..services.notification import create_notification

maintenance_bp = Blueprint("maintenance", __name__)

@maintenance_bp.post("")
@jwt_required()
def create_maintenance():
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    
    asset_id = data.get("asset_id")
    issue_description = data.get("issue_description")
    priority = data.get("priority", "medium")  # low|medium|high
    photo_url = data.get("photo_url") or data.get("photo")
    cost = data.get("cost", 0.0)

    if not asset_id or not issue_description:
        return jsonify({"error": "bad_request", "message": "asset_id and issue_description are required"}), 400

    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({"error": "not_found", "message": "Asset not found"}), 404

    # 1. Prevent duplicate active maintenance requests:
    # An active request is anything that is NOT 'resolved' and NOT 'rejected'.
    active_request = MaintenanceRequest.query.filter(
        MaintenanceRequest.asset_id == asset_id,
        MaintenanceRequest.status.notin_(["resolved", "rejected"])
    ).first()

    if active_request:
        return jsonify({
            "error": "conflict", 
            "message": f"Asset already has an active maintenance request (ID: {active_request.id}, Status: {active_request.status})."
        }), 409

    req = MaintenanceRequest(
        asset_id=asset_id,
        raised_by_employee_id=current_user_id,
        issue_description=issue_description,
        priority=priority,
        photo_url=photo_url,
        cost=cost,
        status="pending"
    )

    db.session.add(req)
    db.session.commit()

    # Log activity
    log_activity(
        employee_id=current_user_id,
        action="maintenance_created",
        details=f"Raised maintenance request #{req.id} for Asset '{asset.name}' ({asset.asset_tag})"
    )

    return jsonify(req.to_dict()), 201


@maintenance_bp.get("")
@jwt_required()
def list_maintenance():
    query = db.session.query(MaintenanceRequest, Asset, Employee).join(
        Asset, MaintenanceRequest.asset_id == Asset.id
    ).outerjoin(
        Employee, MaintenanceRequest.raised_by_employee_id == Employee.id
    )

    # Filtering
    status = request.args.get("status")
    if status:
        query = query.filter(MaintenanceRequest.status == status)

    priority = request.args.get("priority")
    if priority:
        query = query.filter(MaintenanceRequest.priority == priority)

    asset_id = request.args.get("asset_id")
    if asset_id:
        try:
            query = query.filter(MaintenanceRequest.asset_id == int(asset_id))
        except ValueError:
            pass

    search = request.args.get("search")
    if search:
        query = query.filter(
            or_(
                MaintenanceRequest.issue_description.ilike(f"%{search}%"),
                MaintenanceRequest.technician_name.ilike(f"%{search}%"),
                Asset.name.ilike(f"%{search}%"),
                Asset.asset_tag.ilike(f"%{search}%")
            )
        )

    results = query.all()
    out = []
    for req, asset, emp in results:
        d = req.to_dict()
        d["asset_name"] = asset.name
        d["asset_tag"] = asset.asset_tag
        d["raised_by_name"] = emp.name if emp else "System"
        d["raised_by_email"] = emp.email if emp else None
        out.append(d)

    return jsonify(out)


@maintenance_bp.get("/<int:req_id>")
@jwt_required()
def get_maintenance(req_id):
    result = db.session.query(MaintenanceRequest, Asset, Employee).join(
        Asset, MaintenanceRequest.asset_id == Asset.id
    ).outerjoin(
        Employee, MaintenanceRequest.raised_by_employee_id == Employee.id
    ).filter(MaintenanceRequest.id == req_id).first()

    if not result:
        return jsonify({"error": "not_found", "message": "Maintenance request not found"}), 404

    req, asset, emp = result
    d = req.to_dict()
    d["asset"] = asset.to_dict()
    d["raised_by"] = emp.to_dict() if emp else None
    return jsonify(d)


@maintenance_bp.patch("/<int:req_id>")
@role_required("admin", "asset_manager", "department_head")
def update_maintenance(req_id):
    current_user_id = int(get_jwt_identity())
    req = MaintenanceRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "not_found", "message": "Maintenance request not found"}), 404

    asset = Asset.query.get(req.asset_id)
    data = request.get_json() or {}

    old_status = req.status
    new_status = data.get("status")

    if "priority" in data:
        req.priority = data["priority"]
    if "issue_description" in data:
        req.issue_description = data["issue_description"]
    if "photo_url" in data:
        req.photo_url = data["photo_url"]
    if "cost" in data:
        req.cost = float(data["cost"])
    if "technician_name" in data:
        req.technician_name = data["technician_name"]

    if new_status and new_status != old_status:
        # Validate status transitions
        # pending -> approved / rejected
        # approved -> assigned
        # assigned -> in_progress
        # in_progress -> resolved
        valid_transitions = {
            "pending": ["approved", "rejected"],
            "approved": ["assigned", "rejected"],
            "rejected": [],
            "assigned": ["in_progress", "resolved"],
            "in_progress": ["resolved"],
            "resolved": []
        }
        
        # Allow admin/manager to skip states if necessary, but log it
        req.status = new_status

        # 2. Automatically update asset status while maintenance is active:
        # If status transitions to approved, assigned, or in_progress, set asset status to 'under_maintenance'.
        if new_status in ["approved", "assigned", "in_progress"]:
            if asset and asset.status != "under_maintenance":
                asset.status = "under_maintenance"
                db.session.add(asset)

        # If status is resolved, set asset status back to 'available'.
        elif new_status == "resolved":
            if asset:
                asset.status = "available"
                db.session.add(asset)

        # If status is rejected, keep or restore asset status to 'available'.
        elif new_status == "rejected":
            if asset and asset.status == "under_maintenance":
                asset.status = "available"
                db.session.add(asset)

        # Log appropriate activity
        action_map = {
            "approved": "maintenance_approved",
            "rejected": "maintenance_rejected",
            "assigned": "technician_assigned",
            "in_progress": "maintenance_in_progress",
            "resolved": "maintenance_resolved"
        }
        action = action_map.get(new_status, "maintenance_updated")
        log_activity(
            employee_id=current_user_id,
            action=action,
            details=f"Updated Maintenance Request #{req.id} status from '{old_status}' to '{new_status}'. Cost: {req.cost}"
        )

        # Send notification to the reporter
        if req.raised_by_employee_id:
            msg = f"Your maintenance request #{req.id} for Asset '{asset.name if asset else ''}' was updated to '{new_status.replace('_', ' ')}'."
            if req.technician_name:
                msg += f" Technician: {req.technician_name}."
            create_notification(req.raised_by_employee_id, msg, f"maintenance_{new_status}")

    db.session.commit()
    return jsonify(req.to_dict())


@maintenance_bp.post("/<int:req_id>/assign")
@role_required("admin", "asset_manager", "department_head")
def assign_technician(req_id):
    current_user_id = int(get_jwt_identity())
    req = MaintenanceRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "not_found", "message": "Maintenance request not found"}), 404

    data = request.get_json() or {}
    technician_name = data.get("technician_name")
    if not technician_name:
        return jsonify({"error": "bad_request", "message": "technician_name is required"}), 400

    old_status = req.status
    req.technician_name = technician_name
    req.status = "assigned"

    asset = Asset.query.get(req.asset_id)
    if asset and asset.status != "under_maintenance":
        asset.status = "under_maintenance"
        db.session.add(asset)

    log_activity(
        employee_id=current_user_id,
        action="technician_assigned",
        details=f"Assigned technician '{technician_name}' to Maintenance Request #{req.id} (Status: assigned)"
    )

    if req.raised_by_employee_id:
        create_notification(
            req.raised_by_employee_id,
            f"Technician '{technician_name}' has been assigned to your maintenance request #{req.id}.",
            "maintenance_assignment"
        )

    db.session.commit()
    return jsonify(req.to_dict())


@maintenance_bp.delete("/<int:req_id>")
@role_required("admin", "asset_manager")
def delete_maintenance(req_id):
    current_user_id = int(get_jwt_identity())
    req = MaintenanceRequest.query.get(req_id)
    if not req:
        return jsonify({"error": "not_found", "message": "Maintenance request not found"}), 404

    asset_id = req.asset_id
    db.session.delete(req)
    
    # If the asset status was 'under_maintenance', reset it back to 'available' since the request is deleted
    asset = Asset.query.get(asset_id)
    if asset and asset.status == "under_maintenance":
        # Check if there are any other active requests. If not, set available.
        other_active = MaintenanceRequest.query.filter(
            MaintenanceRequest.asset_id == asset_id,
            MaintenanceRequest.id != req_id,
            MaintenanceRequest.status.notin_(["resolved", "rejected"])
        ).first()
        if not other_active:
            asset.status = "available"
            db.session.add(asset)

    log_activity(
        employee_id=current_user_id,
        action="maintenance_deleted",
        details=f"Deleted Maintenance Request #{req_id} for Asset ID {asset_id}"
    )

    db.session.commit()
    return jsonify({"message": "Maintenance request deleted successfully"})
