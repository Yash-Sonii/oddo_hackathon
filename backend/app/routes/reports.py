from flask import Blueprint, request, jsonify, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_
from datetime import datetime, timedelta
import csv
import io
from ..extensions import db
from ..models import Asset, Allocation, MaintenanceRequest, AuditCycle, AuditRecord, Department, Employee, ReportMetadata
from .auth import role_required
from ..services.activity import log_activity

reports_bp = Blueprint("reports", __name__)

@reports_bp.get("/dashboard")
@jwt_required()
def get_analytics():
    # Parse date filters if provided
    start_date_str = request.args.get("start_date")
    end_date_str = request.args.get("end_date")
    
    start_date = None
    end_date = None
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
    except ValueError:
        return jsonify({"error": "bad_request", "message": "Invalid date format. Use YYYY-MM-DD"}), 400

    # 1. Asset Utilization
    total_assets = Asset.query.filter(Asset.status.notin_(["retired", "disposed"])).count()
    allocated_assets = Asset.query.filter_by(status="allocated").count()
    utilization_rate = round((allocated_assets / total_assets) * 100, 2) if total_assets > 0 else 0.0

    # 2. Maintenance Frequency (Top 5 most maintained assets)
    maint_query = db.session.query(
        Asset.name, Asset.asset_tag, func.count(MaintenanceRequest.id).label("maint_count")
    ).join(
        Asset, MaintenanceRequest.asset_id == Asset.id
    )
    if start_date:
        maint_query = maint_query.filter(MaintenanceRequest.created_at >= start_date)
    if end_date:
        maint_query = maint_query.filter(MaintenanceRequest.created_at <= end_date)
        
    freq_rows = maint_query.group_by(Asset.id).order_by(func.count(MaintenanceRequest.id).desc()).limit(5).all()
    maintenance_frequency = [{"name": name, "tag": tag, "count": count} for name, tag, count in freq_rows]

    # 3. Department-wise Asset Summary (active allocations only)
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
    if start_date:
        dept_query = dept_query.filter(Allocation.allocated_date >= start_date.date())
    if end_date:
        dept_query = dept_query.filter(Allocation.allocated_date <= end_date.date())
        
    dept_rows = dept_query.group_by(Department.id).all()
    department_summary = [
        {
            "department": name, 
            "count": count, 
            "value": round(float(value or 0), 2)
        } for name, count, value in dept_rows
    ]

    # 4. Audit Completion Percentage (for the latest cycle)
    latest_cycle = AuditCycle.query.order_by(AuditCycle.start_date.desc()).first()
    audit_stats = {"cycle_id": None, "completion_percentage": 0.0, "status": "no_cycle"}
    if latest_cycle:
        # Get assets in scope
        from .audit import get_assets_in_scope
        assets_in_scope = get_assets_in_scope(latest_cycle.scope_department_id, latest_cycle.scope_location)
        total_in_scope = len(assets_in_scope)
        audited_count = AuditRecord.query.filter_by(audit_cycle_id=latest_cycle.id).count()
        completion_pct = round((audited_count / total_in_scope) * 100, 2) if total_in_scope > 0 else 100.0
        
        audit_stats = {
            "cycle_id": latest_cycle.id,
            "completion_percentage": completion_pct,
            "status": latest_cycle.status,
            "total_assets": total_in_scope,
            "audited_assets": audited_count
        }

    # 5. Missing & Damaged Statistics
    missing_count = Asset.query.filter_by(status="lost").count()
    damaged_count = Asset.query.filter_by(condition="damaged").count()

    # 6. Maintenance Cost Summary
    cost_query = db.session.query(func.sum(MaintenanceRequest.cost))
    if start_date:
        cost_query = cost_query.filter(MaintenanceRequest.created_at >= start_date)
    if end_date:
        cost_query = cost_query.filter(MaintenanceRequest.created_at <= end_date)
    total_cost = cost_query.scalar() or 0.0

    # Monthly maintenance cost chart data (past 6 months by default, or filter range)
    if start_date or end_date:
        monthly_maint_query = MaintenanceRequest.query
        if start_date:
            monthly_maint_query = monthly_maint_query.filter(MaintenanceRequest.created_at >= start_date)
        if end_date:
            monthly_maint_query = monthly_maint_query.filter(MaintenanceRequest.created_at <= end_date)
    else:
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_maint_query = MaintenanceRequest.query.filter(MaintenanceRequest.created_at >= six_months_ago)
    
    monthly_requests = monthly_maint_query.all()
    cost_by_month = {}
    for r in monthly_requests:
        month_str = r.created_at.strftime("%b %Y") if r.created_at else "Unknown"
        cost_by_month[month_str] = cost_by_month.get(month_str, 0.0) + (r.cost or 0.0)
    
    # Sort months chronologically
    def get_month_date(item):
        try:
            return datetime.strptime(item["month"], "%b %Y")
        except Exception:
            return datetime.min

    monthly_costs = [{"month": m, "cost": round(c, 2)} for m, c in cost_by_month.items()]
    monthly_costs.sort(key=get_month_date)

    return jsonify({
        "utilization_rate": utilization_rate,
        "total_assets": total_assets,
        "allocated_assets": allocated_assets,
        "maintenance_frequency": maintenance_frequency,
        "department_summary": department_summary,
        "audit_stats": audit_stats,
        "missing_assets_count": missing_count,
        "damaged_assets_count": damaged_count,
        "total_maintenance_cost": round(total_cost, 2),
        "monthly_maintenance_costs": monthly_costs
    })


@reports_bp.get("/export")
@jwt_required(optional=True)
def export_report():
    identity = get_jwt_identity()
    if not identity:
        token = request.args.get("token")
        if token:
            from flask_jwt_extended import decode_token
            try:
                decoded = decode_token(token)
                identity = decoded["sub"]
            except Exception:
                return jsonify({"error": "unauthorized", "message": "Invalid token"}), 401
        else:
            return jsonify({"error": "unauthorized", "message": "Missing token"}), 401
    
    current_user_id = int(identity)
    report_type = request.args.get("type", "assets")  # assets|maintenance|audits
    report_format = request.args.get("format", "csv")  # csv only (pdf will be mocked / handled by client)

    # Log export activity
    log_activity(
        employee_id=current_user_id,
        action="report_exported",
        details=f"Exported '{report_type}' report as {report_format.upper()}"
    )

    # Save Report Metadata
    user = Employee.query.get(current_user_id)
    report_name = f"{report_type.capitalize()} Report - {datetime.utcnow().strftime('%Y%m%d')}"
    meta = ReportMetadata(
        name=report_name,
        type=report_type,
        format=report_format,
        created_by_employee_id=current_user_id,
        filters={"type": report_type, "format": report_format}
    )
    db.session.add(meta)
    db.session.commit()

    if report_format == "csv":
        si = io.StringIO()
        cw = csv.writer(si)

        if report_type == "assets":
            # Write Header
            cw.writerow(["Asset Tag", "Asset Name", "Category ID", "Serial Number", "Location", "Condition", "Status", "Acquisition Cost", "Acquisition Date"])
            assets = Asset.query.all()
            for a in assets:
                cw.writerow([
                    a.asset_tag, 
                    a.name, 
                    a.category_id, 
                    a.serial_number or "", 
                    a.location or "", 
                    a.condition or "", 
                    a.status or "", 
                    a.acquisition_cost or 0.0, 
                    a.acquisition_date.isoformat() if a.acquisition_date else ""
                ])
        
        elif report_type == "maintenance":
            # Write Header
            cw.writerow(["Request ID", "Asset Tag", "Asset Name", "Issue Description", "Priority", "Status", "Technician Assigned", "Cost", "Created At"])
            reqs = db.session.query(MaintenanceRequest, Asset).join(Asset, MaintenanceRequest.asset_id == Asset.id).all()
            for r, asset in reqs:
                cw.writerow([
                    r.id,
                    asset.asset_tag,
                    asset.name,
                    r.issue_description or "",
                    r.priority or "",
                    r.status or "",
                    r.technician_name or "",
                    r.cost or 0.0,
                    r.created_at.isoformat() if r.created_at else ""
                ])

        elif report_type == "audits":
            # Write Header
            cw.writerow(["Audit Record ID", "Cycle ID", "Asset Tag", "Asset Name", "Audited Result", "Notes"])
            records = db.session.query(AuditRecord, AuditCycle, Asset).join(
                AuditCycle, AuditRecord.audit_cycle_id == AuditCycle.id
            ).join(
                Asset, AuditRecord.asset_id == Asset.id
            ).all()
            for r, cycle, asset in records:
                cw.writerow([
                    r.id,
                    cycle.id,
                    asset.asset_tag,
                    asset.name,
                    r.result or "",
                    r.notes or ""
                ])
        
        else:
            return jsonify({"error": "bad_request", "message": "Unknown report type"}), 400

        output = make_response_csv(si.getvalue(), f"{report_type}_report.csv")
        return output

    return jsonify({"error": "bad_request", "message": "Invalid format"}), 400


def make_response_csv(csv_text, filename):
    return Response(
        csv_text,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename={filename}"}
    )
