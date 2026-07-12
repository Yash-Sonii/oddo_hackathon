# AssetFlow Backend

Flask + SQLAlchemy + JWT. SQLite file at `backend/db.sqlite3`.

## Run locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Server: http://localhost:5000

## Bootstrap admin (first-time setup)

The very first employee promoted to admin has to be done manually because
`PATCH /api/employees/<id>/role` is admin-only. Signup one user, then in a
Python shell:

```bash
python -c "from app import create_app, db; from app.models import Employee; \
app=create_app(); app.app_context().push(); \
e=Employee.query.filter_by(email='you@example.com').first(); e.role='admin'; db.session.commit(); print('ok')"
```

After that, use `PATCH /api/employees/<id>/role` for everyone else.

## Modules owned by this file set

- `routes/auth.py` — signup/login/forgot-password + `@role_required`
- `routes/org_setup.py` — Department + AssetCategory CRUD, employee list, role promotion
- `routes/dashboard.py` — KPIs + overdue returns

Teammates add their blueprints under `app/routes/` and register them in
`app/__init__.py`. `app/models.py` is the ONLY place models live.
