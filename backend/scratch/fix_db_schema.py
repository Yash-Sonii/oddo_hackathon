import os
import sys
import sqlite3

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db.sqlite3')
    print("Database path:", db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [row[0] for row in cursor.fetchall()]
    print("Existing tables:", tables)
    
    # 2. Check and fix maintenance_requests columns
    cursor.execute("PRAGMA table_info(maintenance_requests);")
    maint_columns = [row[1] for row in cursor.fetchall()]
    print("maintenance_requests columns:", maint_columns)
    
    if "cost" not in maint_columns:
        print("Adding 'cost' column to 'maintenance_requests' table...")
        cursor.execute("ALTER TABLE maintenance_requests ADD COLUMN cost REAL DEFAULT 0.0;")
        conn.commit()
        print("'cost' column added successfully.")
    
    # 3. Double check other tables we created:
    # audit_cycles, audit_assignments, audit_records, notifications, activity_logs, report_metadata
    new_tables = ["audit_cycles", "audit_assignments", "audit_records", "notifications", "activity_logs", "report_metadata"]
    for table in new_tables:
        if table not in tables:
            print(f"Table '{table}' is missing. Running db.create_all() to build it...")
            db.create_all()
            break
            
    conn.close()
    print("Database schema check and fix complete.")
