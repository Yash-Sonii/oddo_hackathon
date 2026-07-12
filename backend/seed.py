import os
import sys
from datetime import datetime, date, timedelta
from werkzeug.security import generate_password_hash

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models import Department, Employee, Asset, Allocation, MaintenanceRequest, AuditCycle, AuditAssignment, AuditRecord, Notification, ActivityLog

app = create_app()

with app.app_context():
    print("Creating all tables...")
    db.create_all()

    # Check if we already have seed data
    if Department.query.first() is not None:
        print("Database already contains data, skipping seeding.")
        sys.exit(0)

    print("Seeding database...")

    # 1. Departments
    engineering = Department(name="Engineering", code="ENG")
    marketing = Department(name="Marketing", code="MKT")
    sales = Department(name="Sales", code="SLS")
    finance = Department(name="Finance", code="FIN")
    hr = Department(name="Human Resources", code="HR")
    
    db.session.add_all([engineering, marketing, sales, finance, hr])
    db.session.commit()

    # 2. Employees (Admins & Auditors)
    admin = Employee(
        name="Jay Vaghela",
        email="jay@assetflow.com",
        password_hash=generate_password_hash("password123"),
        role="admin",
        department_id=engineering.id
    )
    auditor = Employee(
        name="Sarah Connor",
        email="sarah@assetflow.com",
        password_hash=generate_password_hash("password123"),
        role="asset_manager",
        department_id=finance.id
    )
    employee = Employee(
        name="John Doe",
        email="john@assetflow.com",
        password_hash=generate_password_hash("password123"),
        role="employee",
        department_id=engineering.id
    )
    
    db.session.add_all([admin, auditor, employee])
    db.session.commit()

    # 3. Assets
    macbook1 = Asset(
        asset_tag="AST-0001",
        name="MacBook Pro M3 Max",
        category_id=1,  # Laptops
        serial_number="C02X87221",
        location="HQ Office - Floor 2",
        condition="good",
        status="allocated",
        acquisition_cost=3499.00,
        acquisition_date=date(2025, 6, 1)
    )
    macbook2 = Asset(
        asset_tag="AST-0002",
        name="MacBook Air M2",
        category_id=1,
        serial_number="C02F28192",
        location="HQ Office - Floor 1",
        condition="good",
        status="allocated",
        acquisition_cost=1299.00,
        acquisition_date=date(2025, 8, 15)
    )
    monitor1 = Asset(
        asset_tag="AST-0003",
        name="Dell UltraSharp 32-inch 4K",
        category_id=2,  # Monitors
        serial_number="MX-892812",
        location="HQ Office - Floor 2",
        condition="good",
        status="allocated",
        acquisition_cost=899.00,
        acquisition_date=date(2025, 7, 10)
    )
    chair = Asset(
        asset_tag="AST-0004",
        name="Herman Miller Aeron Chair",
        category_id=3,  # Furniture
        serial_number="HM-AERON-99",
        location="HQ Office - Floor 2",
        condition="damaged",
        status="under_maintenance",
        acquisition_cost=1499.00,
        acquisition_date=date(2025, 1, 15)
    )
    ipad = Asset(
        asset_tag="AST-0005",
        name="iPad Pro 12.9-inch",
        category_id=4,  # Tablets
        serial_number="DL-IPAD-332",
        location="Remote",
        condition="good",
        status="available",
        acquisition_cost=1099.00,
        acquisition_date=date(2025, 9, 20)
    )
    projector = Asset(
        asset_tag="AST-0006",
        name="Epson 4K Projector",
        category_id=5,  # Audio/Video
        serial_number="EP-PROJ-88",
        location="HQ Meeting Room A",
        condition="good",
        status="lost",
        acquisition_cost=1999.00,
        acquisition_date=date(2024, 12, 1)
    )

    db.session.add_all([macbook1, macbook2, monitor1, chair, ipad, projector])
    db.session.commit()

    # 4. Allocations
    alloc1 = Allocation(
        asset_id=macbook1.id,
        employee_id=admin.id,
        department_id=engineering.id,
        allocated_date=date(2025, 6, 2),
        status="active"
    )
    alloc2 = Allocation(
        asset_id=macbook2.id,
        employee_id=employee.id,
        department_id=engineering.id,
        allocated_date=date(2025, 8, 16),
        status="active"
    )
    alloc3 = Allocation(
        asset_id=monitor1.id,
        employee_id=admin.id,
        department_id=engineering.id,
        allocated_date=date(2025, 7, 11),
        status="active"
    )

    db.session.add_all([alloc1, alloc2, alloc3])
    db.session.commit()

    # 5. Maintenance Requests
    req1 = MaintenanceRequest(
        asset_id=chair.id,
        raised_by_employee_id=employee.id,
        issue_description="Cylinder does not maintain height. Needs replacement gas lift piston.",
        priority="medium",
        status="assigned",
        technician_name="FixIt Contractors",
        cost=150.00,
        created_at=datetime.utcnow() - timedelta(days=5)
    )
    req2 = MaintenanceRequest(
        asset_id=macbook1.id,
        raised_by_employee_id=admin.id,
        issue_description="Screen flicker on right side. Checked panel connector.",
        priority="critical",
        status="resolved",
        technician_name="Apple Service Center",
        cost=450.00,
        created_at=datetime.utcnow() - timedelta(days=35)
    )
    req3 = MaintenanceRequest(
        asset_id=monitor1.id,
        raised_by_employee_id=admin.id,
        issue_description="Power supply port loose. Flickers when moved.",
        priority="low",
        status="resolved",
        technician_name="In-House Support",
        cost=50.00,
        created_at=datetime.utcnow() - timedelta(days=65)
    )

    db.session.add_all([req1, req2, req3])
    db.session.commit()

    # 6. Audit Cycle & Records
    cycle = AuditCycle(
        scope_department_id=engineering.id,
        scope_location="HQ Office - Floor 2",
        start_date=date(2025, 12, 1),
        end_date=date(2025, 12, 10),
        status="open"
    )
    db.session.add(cycle)
    db.session.commit()

    assign = AuditAssignment(
        audit_cycle_id=cycle.id,
        auditor_employee_id=auditor.id
    )
    db.session.add(assign)
    db.session.commit()

    # Records for macbook1, monitor1, and chair (which are in scope for Floor 2 & Eng dept)
    record1 = AuditRecord(
        audit_cycle_id=cycle.id,
        asset_id=macbook1.id,
        result="verified",
        notes="Asset located on desk, in pristine condition."
    )
    record2 = AuditRecord(
        audit_cycle_id=cycle.id,
        asset_id=monitor1.id,
        result="verified",
        notes="Verified on monitor arm, normal wear."
    )
    record3 = AuditRecord(
        audit_cycle_id=cycle.id,
        asset_id=chair.id,
        result="damaged",
        notes="Gas piston failing. Requested maintenance."
    )

    db.session.add_all([record1, record2, record3])
    db.session.commit()

    # 7. Notifications
    notif1 = Notification(
        employee_id=admin.id,
        message="A critical maintenance request has been submitted for MacBook Pro AST-0001.",
        type="maintenance_critical",
        is_read=False
    )
    notif2 = Notification(
        employee_id=auditor.id,
        message="You have been assigned as the auditor for Audit Cycle #1.",
        type="upcoming_audit",
        is_read=True
    )
    
    db.session.add_all([notif1, notif2])
    db.session.commit()

    # 8. Activity Logs
    log1 = ActivityLog(
        employee_id=admin.id,
        employee_name=admin.name,
        action="maintenance_created",
        details="Raised maintenance request for MacBook Pro M3 Max"
    )
    log2 = ActivityLog(
        employee_id=auditor.id,
        employee_name=auditor.name,
        action="audit_recorded",
        details="Recorded damaged status on Herman Miller chair during Cycle #1"
    )
    
    db.session.add_all([log1, log2])
    db.session.commit()

    print("Database successfully seeded! Ready for demonstration.")
