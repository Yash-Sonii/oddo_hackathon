from flask import Blueprint, request, jsonify
from sqlalchemy import or_
from ..models import ActivityLog
from .auth import role_required

activity_logs_bp = Blueprint("activity_logs", __name__)

@activity_logs_bp.get("")
@role_required("admin", "asset_manager")
def list_logs():
    query = ActivityLog.query

    # Filters
    action = request.args.get("action")
    if action:
        query = query.filter(ActivityLog.action == action)

    search = request.args.get("search")
    if search:
        query = query.filter(
            or_(
                ActivityLog.employee_name.ilike(f"%{search}%"),
                ActivityLog.action.ilike(f"%{search}%"),
                ActivityLog.details.ilike(f"%{search}%")
            )
        )

    # Sort
    logs = query.order_by(ActivityLog.timestamp.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs])
