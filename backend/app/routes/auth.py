import re

from flask import Blueprint, jsonify, session
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import json_body, login_required
from ..db import IntegrityError, execute, fetch_one
from ..errors import ApiError

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
LANGS = ("ar", "en")
THEMES = ("light", "dark")
USER_COLS = "id, name, email, language, theme"


@bp.post("/register")
def register():
    data = json_body()
    name = str(data.get("name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    language = data.get("language") if data.get("language") in LANGS else "ar"
    theme = data.get("theme") if data.get("theme") in THEMES else "light"

    if not name or len(name) > 100:
        raise ApiError("invalid_name")
    if not EMAIL_RE.match(email) or len(email) > 255:
        raise ApiError("invalid_email")
    if len(password) < 8 or len(password) > 128:
        raise ApiError("weak_password")
    if fetch_one("SELECT id FROM users WHERE email = %s", (email,)):
        raise ApiError("email_taken", 409)

    try:
        user = execute(
            f"INSERT INTO users (name, email, password_hash, language, theme) "
            f"VALUES (%s, %s, %s, %s, %s) RETURNING {USER_COLS}",
            (name, email, generate_password_hash(password), language, theme),
            returning=True,
        )
    except IntegrityError:
        raise ApiError("email_taken", 409)

    session.clear()
    session["user_id"] = user["id"]
    session.permanent = True
    return jsonify(user=user), 201


@bp.post("/login")
def login():
    data = json_body()
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    row = fetch_one("SELECT id, password_hash FROM users WHERE email = %s", (email,))
    if not row or not check_password_hash(row["password_hash"], password):
        raise ApiError("invalid_credentials", 401)
    session.clear()
    session["user_id"] = row["id"]
    session.permanent = True
    user = fetch_one(f"SELECT {USER_COLS} FROM users WHERE id = %s", (row["id"],))
    return jsonify(user=user)


@bp.post("/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


@bp.get("/me")
@login_required
def me():
    from flask import g
    return jsonify(user=g.user)
