from flask import Blueprint, request, jsonify
from datetime import datetime
from ..extensions import db
from ..models import Asset, AssetCategory, Allocation, MaintenanceRequest
from .auth import role_required
from ..services.asset_lifecycle import (
    change_asset_status,
    AssetNotFoundError,
    InvalidStatusTransitionError
)

assets_bp = Blueprint("assets", __name__)

@assets_bp.post("")
@role_required("admin", "asset_manager")
def register_asset():
    data = request.get_json() or {}
    name = data.get("name")
    if not name:
        return jsonify({"error": "Name is required"}), 400

    category_id = data.get("category_id")
    if not category_id:
        return jsonify({"error": "Category ID is required"}), 400

    # Validate category_id exists in the shared AssetCategory table
    category = AssetCategory.query.get(category_id)
    if not category:
        return jsonify({"error": f"Category ID {category_id} does not exist"}), 400

    # Auto-generate sequential Asset Tag (AF-0001, AF-0002...)
    # Query database to find the max tag sequence
    all_tags = db.session.query(Asset.asset_tag).filter(Asset.asset_tag.like("AF-%")).all()
    max_num = 0
    for (tag,) in all_tags:
        if tag:
            try:
                parts = tag.split("-")
                if len(parts) == 2 and parts[1].isdigit():
                    num = int(parts[1])
                    if num > max_num:
                        max_num = num
            except Exception:
                pass
    next_num = max_num + 1
    asset_tag = f"AF-{next_num:04d}"

    # Parse date
    acq_date = None
    acq_date_str = data.get("acquisition_date")
    if acq_date_str:
        try:
            acq_date = datetime.strptime(acq_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format, use YYYY-MM-DD"}), 400

    asset = Asset(
        name=name,
        category_id=category_id,
        asset_tag=asset_tag,
        serial_number=data.get("serial_number"),
        acquisition_date=acq_date,
        acquisition_cost=data.get("acquisition_cost"),
        condition=data.get("condition"),
        location=data.get("location"),
        is_bookable=bool(data.get("is_bookable", False)),
        photo_url=data.get("photo_url") or data.get("photo"),
        status="available"  # Default status
    )

    db.session.add(asset)
    db.session.commit()

    return jsonify(asset.to_dict()), 201

@assets_bp.get("")
@role_required("admin", "asset_manager", "department_head", "employee")
def list_assets():
    query = Asset.query

    # Exact filters
    category_id = request.args.get("category_id")
    if category_id:
        try:
            query = query.filter(Asset.category_id == int(category_id))
        except ValueError:
            pass

    status = request.args.get("status")
    if status:
        query = query.filter(Asset.status == status)

    # Partial / case-insensitive filters
    tag = request.args.get("asset_tag") or request.args.get("tag")
    if tag:
        query = query.filter(Asset.asset_tag.ilike(f"%{tag}%"))

    serial = request.args.get("serial_number")
    if serial:
        query = query.filter(Asset.serial_number.ilike(f"%{serial}%"))

    location = request.args.get("location")
    if location:
        query = query.filter(Asset.location.ilike(f"%{location}%"))

    # Department filter (join with Allocation)
    department_id = request.args.get("department_id")
    if department_id:
        try:
            query = query.join(Allocation, Allocation.asset_id == Asset.id).filter(
                Allocation.department_id == int(department_id),
                Allocation.status == "active"
            )
        except ValueError:
            pass

    # Generic global search
    search = request.args.get("search")
    if search:
        query = query.filter(
            (Asset.name.ilike(f"%{search}%")) |
            (Asset.asset_tag.ilike(f"%{search}%")) |
            (Asset.serial_number.ilike(f"%{search}%")) |
            (Asset.location.ilike(f"%{search}%"))
        )

    assets = query.all()
    return jsonify([a.to_dict() for a in assets])

@assets_bp.get("/<int:asset_id>")
@role_required("admin", "asset_manager", "department_head", "employee")
def get_asset(asset_id):
    asset = Asset.query.get(asset_id)
    if not asset:
        return jsonify({"error": "Asset not found"}), 404

    # Fetch allocation history (joined from Allocation, date desc)
    allocations = Allocation.query.filter_by(asset_id=asset_id).order_by(Allocation.allocated_date.desc()).all()

    # Fetch maintenance history (joined from MaintenanceRequest, date desc)
    maintenance = MaintenanceRequest.query.filter_by(asset_id=asset_id).order_by(MaintenanceRequest.created_at.desc()).all()

    res = asset.to_dict()
    res["allocation_history"] = [a.to_dict() for a in allocations]
    res["maintenance_history"] = [m.to_dict() for m in maintenance]

    return jsonify(res)

@assets_bp.patch("/<int:asset_id>/status")
@role_required("admin", "asset_manager", "department_head")
def update_status(asset_id):
    data = request.get_json() or {}
    new_status = data.get("status")
    if not new_status:
        return jsonify({"error": "Status is required"}), 400

    try:
        asset = change_asset_status(asset_id, new_status)
        return jsonify(asset.to_dict())
    except AssetNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except InvalidStatusTransitionError as e:
        return jsonify({"error": str(e)}), 409
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
