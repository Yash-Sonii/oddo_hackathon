from ..extensions import db
from ..models import ActivityLog, Employee

def log_activity(employee_id, action, details=None):
    """
    Log an action performed by an employee or system.
    """
    try:
        emp_name = None
        if employee_id:
            emp = Employee.query.get(int(employee_id))
            if emp:
                emp_name = emp.name
        
        log = ActivityLog(
            employee_id=employee_id,
            employee_name=emp_name,
            action=action,
            details=details
        )
        db.session.add(log)
        db.session.commit()
        return log
    except Exception as e:
        db.session.rollback()
        print(f"Error logging activity: {e}")
        return None
