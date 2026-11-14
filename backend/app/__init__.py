import os
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

from . import db
from .config import Config
from .errors import register_error_handlers


def create_app(overrides=None):
    default_frontend = Path(__file__).resolve().parents[2] / "frontend"
    frontend = os.environ.get("FRONTEND_DIR") or str(default_frontend)

    app = Flask(__name__, static_folder=frontend, static_url_path="")
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)

    if not app.config.get("SECRET_KEY"):
        raise RuntimeError("SECRET_KEY is not set. Copy .env.example to .env and set a random value.")
    if str(app.config["SECRET_KEY"]).startswith("replace-with"):
        raise RuntimeError("SECRET_KEY still has the example value. Generate one: python3 -c 'import secrets; print(secrets.token_hex(32))'")
    if not app.config.get("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL is not set. Copy .env.example to .env and edit it.")

    db.init_app(app)
    register_error_handlers(app)

    from .routes import auth, profile, projects, tasks
    for module in (auth, profile, projects, tasks):
        app.register_blueprint(module.bp)

    @app.get("/api/health")
    def health():
        try:
            db.fetch_one("SELECT 1 AS ok")
            return jsonify(status="ok")
        except Exception:
            app.logger.exception("health check failed")
            return jsonify(status="error"), 503

    @app.get("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.after_request
    def security_headers(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        resp.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
        )
        return resp

    return app
