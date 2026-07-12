import os
import sys

# Add parent directory to path to allow importing app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.models import Employee

app = create_app()

with app.app_context():
    users = Employee.query.all()
    print("--- Database Users ---")
    for u in users:
        print(f"ID: {u.id} | Name: {u.name} | Email: {u.email} | Role: {u.role} | Status: {u.status}")
