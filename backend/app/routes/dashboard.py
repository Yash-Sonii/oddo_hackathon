"""Dashboard KPIs. Defensive queries — teammate tables may be empty."""
from datetime import date, datetime, timedelta
from flask import Blueprint, jsonify
from sqlalchemy import func, and_
from ..extensions import db
from ..models import Asset, Allocation, Booking, MaintenanceRequest, TransferRequest
from .auth import role_required

dashboard_bp = Blueprint("dashboard", __name__)


def _safe_count(query):
    try:
        return query.scalar() or 0
    except Exception:
        return 0


@dashboard_bp.get("/kpis")
@role_required("admin", "asset_manager", "department_head", "employee")
def kpis():
    today = date.today()
    week_ahead = today + timedelta(days=7)
    tomorrow = datetime.combine(today + timedelta(days=1), datetime.min.time())
    today_start = datetime.combine(today, datetime.min.time())

    assets_available = _safe_count(
        db.session.query(func.count(Asset.id)).filter(Asset.status == "available")
    )
    assets_allocated = _safe_count(
        db.session.query(func.count(Asset.id)).filter(Asset.status == "allocated")
    )
    maintenance_today = _safe_count(
        db.session.query(func.count(MaintenanceRequest.id)).filter(
            and_(
                MaintenanceRequest.created_at >= today_start,
                MaintenanceRequest.created_at < tomorrow,
            )
        )
    )
    active_bookings = _safe_count(
        db.session.query(func.count(Booking.id)).filter(
            Booking.status.in_(["upcoming", "ongoing"])
        )
    )
    pending_transfers = _safe_count(
        db.session.query(func.count(TransferRequest.id)).filter(
            TransferRequest.status == "requested"
        )
    )
    upcoming_returns = _safe_count(
        db.session.query(func.count(Allocation.id)).filter(
            and_(
                Allocation.status == "active",
                Allocation.expected_return_date != None,  # noqa: E711
                Allocation.expected_return_date >= today,
                Allocation.expected_return_date <= week_ahead,
            )
        )
    )

    try:
        overdue_rows = (
            db.session.query(Allocation)
            .filter(
                Allocation.status == "active",
                Allocation.expected_return_date != None,  # noqa: E711
                Allocation.expected_return_date < today,
            )
            .order_by(Allocation.expected_return_date.asc())
            .limit(50)
            .all()
        )
        overdue_returns = [
            {
                "allocation_id": a.id,
                "asset_id": a.asset_id,
                "employee_id": a.employee_id,
                "expected_return_date": a.expected_return_date.isoformat()
                if a.expected_return_date else None,
                "days_overdue": (today - a.expected_return_date).days
                if a.expected_return_date else 0,
            }
            for a in overdue_rows
        ]
    except Exception:
        overdue_returns = []

    return jsonify({
        "assets_available": assets_available,
        "assets_allocated": assets_allocated,
        "maintenance_today": maintenance_today,
        "active_bookings": active_bookings,
        "pending_transfers": pending_transfers,
        "upcoming_returns": upcoming_returns,
        "overdue_returns": overdue_returns,
    })
