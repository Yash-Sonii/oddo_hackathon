"""
Shared models for ALL AssetFlow modules. Everyone edits this single file so
schema stays consistent. Field names here are the contract — do not rename.
"""
from datetime import datetime
from .extensions import db


# ---------- Organization ----------
class Department(db.Model):
    __tablename__ = "departments"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    code = db.Column(db.String(32), nullable=False, unique=True)
    head_employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=True)
    parent_department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    employee_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default="active")  # active|inactive

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "code": self.code,
            "head_employee_id": self.head_employee_id,
            "parent_department_id": self.parent_department_id,
            "employee_count": self.employee_count, "status": self.status,
        }


class AssetCategory(db.Model):
    __tablename__ = "asset_categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False, unique=True)
    extra_fields = db.Column(db.JSON, nullable=True)  # e.g. {"warranty_months": "int"}

    def to_dict(self):
        return {"id": self.id, "name": self.name, "extra_fields": self.extra_fields or {}}


# ---------- People ----------
class Employee(db.Model):
    __tablename__ = "employees"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    # role enum: employee | department_head | asset_manager | admin
    role = db.Column(db.String(32), nullable=False, default="employee")
    status = db.Column(db.String(20), default="active")

    def to_dict(self):
        return {
            "id": self.id, "name": self.name, "email": self.email,
            "department_id": self.department_id, "role": self.role, "status": self.status,
        }


# ---------- Assets ----------
class Asset(db.Model):
    __tablename__ = "assets"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("asset_categories.id"), nullable=True)
    asset_tag = db.Column(db.String(32), unique=True)  # AF-0001
    serial_number = db.Column(db.String(120))
    acquisition_date = db.Column(db.Date)
    acquisition_cost = db.Column(db.Float)
    condition = db.Column(db.String(40))
    location = db.Column(db.String(120))
    is_bookable = db.Column(db.Boolean, default=False)
    photo_url = db.Column(db.String(500), nullable=True)
    # status: available|allocated|reserved|under_maintenance|lost|retired|disposed
    status = db.Column(db.String(32), default="available")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category_id": self.category_id,
            "asset_tag": self.asset_tag,
            "serial_number": self.serial_number,
            "acquisition_date": self.acquisition_date.isoformat() if self.acquisition_date else None,
            "acquisition_cost": self.acquisition_cost,
            "condition": self.condition,
            "location": self.location,
            "is_bookable": self.is_bookable,
            "photo_url": self.photo_url,
            "status": self.status,
        }



class Allocation(db.Model):
    __tablename__ = "allocations"
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey("assets.id"), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    allocated_date = db.Column(db.Date)
    expected_return_date = db.Column(db.Date)
    actual_return_date = db.Column(db.Date)
    return_condition_notes = db.Column(db.Text)
    status = db.Column(db.String(20), default="active")  # active|returned|overdue

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "employee_id": self.employee_id,
            "department_id": self.department_id,
            "allocated_date": self.allocated_date.isoformat() if self.allocated_date else None,
            "expected_return_date": self.expected_return_date.isoformat() if self.expected_return_date else None,
            "actual_return_date": self.actual_return_date.isoformat() if self.actual_return_date else None,
            "return_condition_notes": self.return_condition_notes,
            "status": self.status,
        }



class TransferRequest(db.Model):
    __tablename__ = "transfer_requests"
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey("assets.id"), nullable=False)
    from_employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"))
    to_employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"))
    requested_by = db.Column(db.Integer, db.ForeignKey("employees.id"))
    status = db.Column(db.String(20), default="requested")  # requested|approved|rejected|completed

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "from_employee_id": self.from_employee_id,
            "to_employee_id": self.to_employee_id,
            "requested_by": self.requested_by,
            "status": self.status,
        }


class Booking(db.Model):
    __tablename__ = "bookings"
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey("assets.id"), nullable=False)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    status = db.Column(db.String(20), default="upcoming")  # upcoming|ongoing|completed|cancelled

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "employee_id": self.employee_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "status": self.status,
        }


class MaintenanceRequest(db.Model):
    __tablename__ = "maintenance_requests"
    id = db.Column(db.Integer, primary_key=True)
    asset_id = db.Column(db.Integer, db.ForeignKey("assets.id"), nullable=False)
    raised_by_employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"))
    issue_description = db.Column(db.Text)
    priority = db.Column(db.String(20))
    photo_url = db.Column(db.String(500))
    # pending|approved|rejected|assigned|in_progress|resolved
    status = db.Column(db.String(20), default="pending")
    technician_name = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "raised_by_employee_id": self.raised_by_employee_id,
            "issue_description": self.issue_description,
            "priority": self.priority,
            "photo_url": self.photo_url,
            "status": self.status,
            "technician_name": self.technician_name,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


# ---------- Audit ----------
class AuditCycle(db.Model):
    __tablename__ = "audit_cycles"
    id = db.Column(db.Integer, primary_key=True)
    scope_department_id = db.Column(db.Integer, db.ForeignKey("departments.id"))
    scope_location = db.Column(db.String(120))
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(20), default="open")  # open|closed


class AuditAssignment(db.Model):
    __tablename__ = "audit_assignments"
    id = db.Column(db.Integer, primary_key=True)
    audit_cycle_id = db.Column(db.Integer, db.ForeignKey("audit_cycles.id"), nullable=False)
    auditor_employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)


class AuditRecord(db.Model):
    __tablename__ = "audit_records"
    id = db.Column(db.Integer, primary_key=True)
    audit_cycle_id = db.Column(db.Integer, db.ForeignKey("audit_cycles.id"), nullable=False)
    asset_id = db.Column(db.Integer, db.ForeignKey("assets.id"), nullable=False)
    result = db.Column(db.String(20))  # verified|missing|damaged
    notes = db.Column(db.Text)


# ---------- Notifications ----------
class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.String(40))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
