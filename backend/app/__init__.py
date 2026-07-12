"""Flask app factory. Teammates: register your blueprint here."""
import os
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .extensions import db


def create_app(config_overrides=None):
    app = Flask(__name__)
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(basedir, 'db.sqlite3')}"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "dev-secret-change-me")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 60 * 60 * 12  # 12h

    if config_overrides:
        app.config.update(config_overrides)

    CORS(app, resources={r"/api/*": {"origins": "*"}})
    JWTManager(app)
    db.init_app(app)

    # Import models so SQLAlchemy sees them before create_all
    from . import models  # noqa: F401

    # Blueprints
    from .routes.auth import auth_bp
    from .routes.org_setup import org_bp
    from .routes.dashboard import dashboard_bp
    from .routes.allocations import allocations_bp
    from .routes.transfers import transfers_bp
    from .routes.bookings import bookings_bp
    from .routes.assets import assets_bp
    from .routes.maintenance import maintenance_bp
    from .routes.audit import audit_bp

    app.register_blueprint(auth_bp,        url_prefix="/api/auth")
    app.register_blueprint(org_bp,         url_prefix="/api")
    app.register_blueprint(dashboard_bp,   url_prefix="/api/dashboard")
    app.register_blueprint(allocations_bp, url_prefix="/api/allocations")
    app.register_blueprint(transfers_bp,   url_prefix="/api/transfers")
    app.register_blueprint(bookings_bp,    url_prefix="/api/bookings")
    app.register_blueprint(assets_bp,      url_prefix="/api/assets")
    app.register_blueprint(maintenance_bp, url_prefix="/api/maintenance")
    app.register_blueprint(audit_bp,       url_prefix="/api/audits")

    # Teammates: register additional blueprints below, e.g.
    # from .routes.assets import assets_bp
    # app.register_blueprint(assets_bp, url_prefix="/api/assets")

    from .routes.maintenance import maintenance_bp
    app.register_blueprint(maintenance_bp, url_prefix="/api/maintenance")

    from .routes.audit import audit_bp
    app.register_blueprint(audit_bp, url_prefix="/api/audits")

    from .routes.reports import reports_bp
    app.register_blueprint(reports_bp, url_prefix="/api/reports")

    from .routes.notifications import notifications_bp
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

    from .routes.activity_logs import activity_logs_bp
    app.register_blueprint(activity_logs_bp, url_prefix="/api/activity-logs")

    @app.errorhandler(404)
    def _404(_): return jsonify({"error": "not_found"}), 404

    @app.errorhandler(400)
    def _400(e): return jsonify({"error": "bad_request", "message": str(e)}), 400

    with app.app_context():
        db.create_all()

    return app
