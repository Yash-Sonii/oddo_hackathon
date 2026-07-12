"""Booking routes — time-slot bookings for bookable assets, with overlap detection."""
from datetime import datetime
from flask import Blueprint, request, jsonify
from sqlalchemy import and_, or_
from ..extensions import db
from ..models import Booking, Asset, Employee
from .auth import role_required

bookings_bp = Blueprint("bookings", __name__)


# ── helpers ──────────────────────────────────────────────────────────────────

def _derive_status(b: Booking) -> str:
    """Compute booking status from current wall-clock time."""
    now = datetime.utcnow()
    if b.status == "cancelled":
        return "cancelled"
    if b.end_time and now >= b.end_time:
        return "completed"
    if b.start_time and now >= b.start_time:
        return "ongoing"
    return "upcoming"


def _booking_dict(b: Booking) -> dict:
    asset = db.session.get(Asset, b.asset_id)
    emp   = db.session.get(Employee, b.employee_id)
    return {
        "id": b.id,
        "asset_id": b.asset_id,
        "asset_name": asset.name if asset else None,
        "asset_tag": asset.asset_tag if asset else None,
        "employee_id": b.employee_id,
        "employee_name": emp.name if emp else None,
        "start_time": b.start_time.isoformat() if b.start_time else None,
        "end_time": b.end_time.isoformat() if b.end_time else None,
        "status": _derive_status(b),
    }


def _parse_dt(val) -> datetime | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(str(val), fmt)
        except ValueError:
            continue
    return None


# ── endpoints ────────────────────────────────────────────────────────────────

@bookings_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_bookings():
    """GET /api/bookings?asset_id=X  — filter by asset; default returns all."""
    asset_id = request.args.get("asset_id", type=int)
    q = Booking.query
    if asset_id:
        q = q.filter(Booking.asset_id == asset_id)
    rows = q.order_by(Booking.start_time.asc()).all()
    return jsonify([_booking_dict(b) for b in rows])


@bookings_bp.post("")
@role_required("admin", "asset_manager", "department_head", "employee")
def create_booking():
    """Create a booking. 409 if [start_time, end_time) overlaps an active booking."""
    data       = request.get_json(silent=True) or {}
    asset_id   = data.get("asset_id")
    emp_id     = data.get("employee_id")
    start_time = _parse_dt(data.get("start_time"))
    end_time   = _parse_dt(data.get("end_time"))

    if not asset_id or not emp_id or not start_time or not end_time:
        return jsonify({"error": "bad_request",
                        "message": "asset_id, employee_id, start_time, end_time required"}), 400
    if end_time <= start_time:
        return jsonify({"error": "bad_request",
                        "message": "end_time must be after start_time"}), 400

    # Bookable check
    asset = db.session.get(Asset, asset_id)
    if not asset:
        return jsonify({"error": "not_found", "message": "Asset not found"}), 404
    if not asset.is_bookable:
        return jsonify({"error": "bad_request", "message": "Asset is not bookable"}), 400

    # Overlap check: reject if any active booking overlaps [start, end)
    # Back-to-back allowed, so: overlap = existing.start < new.end AND existing.end > new.start
    overlap = (
        Booking.query
        .filter(
            Booking.asset_id == asset_id,
            Booking.status.in_(["upcoming", "ongoing"]),
            and_(
                Booking.start_time < end_time,
                Booking.end_time   > start_time,
            ),
        )
        .first()
    )
    if overlap:
        return jsonify({
            "error": "overlap",
            "message": "Time slot overlaps an existing booking",
            "conflicting_booking_id": overlap.id,
            "conflicting_start": overlap.start_time.isoformat() if overlap.start_time else None,
            "conflicting_end":   overlap.end_time.isoformat()   if overlap.end_time   else None,
        }), 409

    booking = Booking(
        asset_id=asset_id,
        employee_id=emp_id,
        start_time=start_time,
        end_time=end_time,
        status="upcoming",
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify(_booking_dict(booking)), 201


@bookings_bp.patch("/<int:booking_id>/cancel")
@role_required("admin", "asset_manager", "department_head", "employee")
def cancel_booking(booking_id: int):
    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "not_found"}), 404
    if booking.status == "cancelled":
        return jsonify({"error": "bad_request", "message": "Already cancelled"}), 400
    if _derive_status(booking) == "completed":
        return jsonify({"error": "bad_request", "message": "Cannot cancel a completed booking"}), 400
    booking.status = "cancelled"
    db.session.commit()
    return jsonify(_booking_dict(booking))
