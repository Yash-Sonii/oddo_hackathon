"""Assets read-only routes — list all assets for UI dropdowns.
CRUD / lifecycle management is owned by Person 2's asset-management module.
This stub is added here so Person 3's allocation/booking forms can populate dropdowns.
"""
from flask import Blueprint, jsonify
from ..models import Asset
from .auth import role_required

assets_stub_bp = Blueprint("assets_stub", __name__)


@assets_stub_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_assets():
    rows = Asset.query.order_by(Asset.name.asc()).all()
    return jsonify([
        {
            "id": a.id,
            "name": a.name,
            "asset_tag": a.asset_tag,
            "status": a.status,
            "is_bookable": a.is_bookable,
            "category_id": a.category_id,
            "location": a.location,
            "condition": a.condition,
        }
        for a in rows
    ])
