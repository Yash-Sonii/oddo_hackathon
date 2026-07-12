# Ralph Loop Autonomous Testing Plan
*Feed this document directly into your Ralph Loop extension/tool as its master prompt.*

## 🎯 Primary Objective
Your goal is to autonomously write, execute, and verify a complete automated testing suite for the **AssetFlow** Enterprise Asset Management project. You will operate in a continuous loop: write tests, execute them, analyze any failures, and fix either the tests or the application code until the entire test suite passes successfully.

## 🏗️ Project Architecture
- **Backend:** Python / Flask REST API using Blueprints.
- **Database:** SQLite (`db.sqlite3`) managed via SQLAlchemy.
- **Authentication:** `Flask-JWT-Extended` (Bearer tokens).
- **Frontend:** Vanilla HTML/JS/CSS (ES Modules) using the native Fetch API.

## 🛠️ Step 1: Environment Setup
1. Navigate to the `backend/` directory.
2. Ensure you are in the correct Python environment.
3. Install the required testing dependencies:
   ```bash
   pip install pytest pytest-flask
   ```
4. Create a `tests/` directory inside `backend/` if it does not already exist.

## 🧪 Step 2: Backend API Testing (Pytest)
Write comprehensive unit and integration tests inside `backend/tests/` to cover the API routes located in `backend/app/routes/`. 

Your tests must verify:
1. **Authentication (`auth.py`)**: 
   - Successful signup (returns 201).
   - Successful login with correct credentials (returns 200).
   - Rejected login with incorrect passwords (returns 401).
2. **Authorization & RBAC**:
   - Ensure routes protected by `@jwt_required()` reject unauthenticated requests.
   - Ensure role-specific actions (e.g., creating assets via `assets.py`, or promoting employees via `org_setup.py`) are strictly restricted to `"admin"`, `"asset_manager"`, or `"department_head"`.
3. **Core Workflows**:
   - Creating a new Asset (`assets.py`).
   - Allocating an asset to an employee (`allocations.py`) and catching double-allocation conflicts (`409 Conflict`).
   - Raising a Maintenance Request (`maintenance.py`).
   - Preventing overlapping meeting room bookings (`bookings.py`).

## 🔄 Step 3: The Autonomous Loop
1. Execute the tests by running:
   ```bash
   python -m pytest backend/tests/ -v
   ```
2. Read the console output.
3. If any test fails, analyze the traceback. 
4. Modify the relevant backend Python file OR the test file to resolve the error.
5. Loop step 1-4 continuously until you achieve a 100% pass rate. 

## 📝 Success Criteria
The loop is considered successfully completed when `pytest` returns zero errors and all critical endpoints have test coverage. Report back with a summary of the executed tests when finished.
