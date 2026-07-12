import os
import sys

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models import Asset, Allocation, MaintenanceRequest, AuditCycle, AuditRecord, Department, Employee

app = create_app()

with app.app_context():
    try:
        print("--- Testing Asset Utilization ---")
        total_assets = Asset.query.filter(Asset.status.notin_(["retired", "disposed"])).count()
        allocated_assets = Asset.query.filter_by(status="allocated").count()
        utilization_rate = round((allocated_assets / total_assets) * 100, 2) if total_assets > 0 else 0.0
        print(f"Total: {total_assets}, Allocated: {allocated_assets}, Util Rate: {utilization_rate}%")

        print("--- Testing Maintenance Frequency ---")
        from sqlalchemy import func
        maint_query = db.session.query(
            Asset.name, Asset.asset_tag, func.count(MaintenanceRequest.id).label("maint_count")
        ).join(
            Asset, MaintenanceRequest.asset_id == Asset.id
        )
        freq_rows = maint_query.group_by(Asset.id).order_by(func.count(MaintenanceRequest.id).desc()).limit(5).all()
        print("Freq rows:", freq_rows)

        print("--- Testing Department-wise Asset Summary ---")
        dept_query = db.session.query(
            Department.name, 
            func.count(Asset.id).label("asset_count"),
            func.sum(Asset.acquisition_cost).label("total_value")
        ).join(
            Allocation, Allocation.department_id == Department.id
        ).join(
            Asset, Allocation.asset_id == Asset.id
        ).filter(
            Allocation.status == "active"
        )
        dept_rows = dept_query.group_by(Department.id).all()
        print("Dept rows:", dept_rows)

        print("--- Testing Audit Stats ---")
        latest_cycle = AuditCycle.query.order_by(AuditCycle.start_date.desc()).first()
        if latest_cycle:
            from app.routes.audit import get_assets_in_scope
            assets_in_scope = get_assets_in_scope(latest_cycle.scope_department_id, latest_cycle.scope_location)
            total_in_scope = len(assets_in_scope)
            audited_count = AuditRecord.query.filter_by(audit_cycle_id=latest_cycle.id).count()
            completion_pct = round((audited_count / total_in_scope) * 100, 2) if total_in_scope > 0 else 100.0
            print(f"Latest cycle ID: {latest_cycle.id}, In Scope: {total_in_scope}, Audited: {audited_count}, Pct: {completion_pct}%")
        else:
            print("No audit cycle found")

        print("--- Testing Maintenance Cost Summary ---")
        cost_query = db.session.query(func.sum(MaintenanceRequest.cost))
        total_cost = cost_query.scalar() or 0.0
        print("Total cost:", total_cost)

        print("Queries run successfully!")
    except Exception as e:
        print("ERROR running queries:", e)
        import traceback
        traceback.print_exc()
