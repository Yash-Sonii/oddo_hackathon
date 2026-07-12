from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import db
from ..models import Notification

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.get("")
@jwt_required()
def list_notifications():
    current_user_id = int(get_jwt_identity())
    notifications = Notification.query.filter_by(employee_id=current_user_id).order_by(Notification.created_at.desc()).all()
    return jsonify([n.to_dict() for n in notifications])


@notifications_bp.patch("/<int:notif_id>/read")
@jwt_required()
def mark_read(notif_id):
    current_user_id = int(get_jwt_identity())
    notif = Notification.query.filter_by(id=notif_id, employee_id=current_user_id).first()
    if not notif:
        return jsonify({"error": "not_found", "message": "Notification not found"}), 404

    data = request.get_json() or {}
    is_read = data.get("is_read", True)
    notif.is_read = is_read
    db.session.commit()
    return jsonify(notif.to_dict())


@notifications_bp.post("/read-all")
@jwt_required()
def mark_all_read():
    current_user_id = int(get_jwt_identity())
    notifications = Notification.query.filter_by(employee_id=current_user_id, is_read=False).all()
    for n in notifications:
        n.is_read = True
    db.session.commit()
    return jsonify({"message": f"Marked {len(notifications)} notifications as read"})
