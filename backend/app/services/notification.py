from ..extensions import db
from ..models import Notification

def create_notification(employee_id, message, notification_type):
    """
    Create a database notification for an employee and log the action.
    """
    try:
        notif = Notification(
            employee_id=int(employee_id),
            message=message,
            type=notification_type,
            is_read=False
        )
        db.session.add(notif)
        db.session.commit()
        
        # Log that a notification was sent
        from .activity import log_activity
        log_activity(
            employee_id=None,
            action="notification_sent",
            details=f"Alert sent to Employee #{employee_id} (Type: {notification_type}): {message}"
        )
        
        return notif
    except Exception as e:
        db.session.rollback()
        print(f"Error creating notification: {e}")
        return None
