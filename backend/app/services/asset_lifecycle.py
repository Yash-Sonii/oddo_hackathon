from ..extensions import db
from ..models import Asset

class AssetNotFoundError(ValueError):
    pass

class InvalidStatusTransitionError(ValueError):
    pass

# Lifecycle states: available|allocated|reserved|under_maintenance|lost|retired|disposed
# Transitions required by spec:
# - available <-> under_maintenance
# - available -> allocated
# - allocated -> available
# - available -> reserved
# - reserved -> available
# - available/allocated/under_maintenance -> lost
# - any status -> retired
# - retired -> disposed
VALID_TRANSITIONS = {
    "available": ["allocated", "reserved", "under_maintenance", "lost", "retired"],
    "allocated": ["available", "lost", "retired"],
    "reserved": ["available", "retired"],
    "under_maintenance": ["available", "lost", "retired"],
    "lost": ["retired"],
    "retired": ["disposed"],  # Terminal state except can go to disposed
    "disposed": []            # Absolute terminal state
}

def change_asset_status(asset_id, new_status):
    """
    Transition an asset to a new status.
    Raises AssetNotFoundError if asset not found.
    Raises InvalidStatusTransitionError if the transition is invalid.
    """
    asset = Asset.query.get(asset_id)
    if not asset:
        raise AssetNotFoundError(f"Asset with ID {asset_id} not found")

    current_status = (asset.status or "available").lower().strip()
    new_status = new_status.lower().strip()

    if new_status not in VALID_TRANSITIONS:
        raise InvalidStatusTransitionError(f"Unknown status: {new_status}")

    # No-op if it's already the target status
    if current_status == new_status:
        return asset

    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise InvalidStatusTransitionError(f"Cannot transition asset from status '{current_status}' to '{new_status}'")

    asset.status = new_status
    db.session.commit()
    return asset
