from flask import Blueprint, g, jsonify
from werkzeug.security import check_password_hash, generate_password_hash

from ..auth import json_body, login_required
from ..db import IntegrityError, execute, fetch_one
from ..errors import ApiError
from .auth import EMAIL_RE, LANGS, THEMES, USER_COLS

bp = Blueprint("profile", __name__, url_prefix="/api/profile")


@bp.get("")
@login_required
def get_profile():
    return jsonify(user=g.user)


@bp.put("")
@login_required
def update_profile():
    data = json_body()
    fields = {}
    if "name" in data:
        name = str(data["name"] or "").strip()
        if not name or len(name) > 100:
            raise ApiError("invalid_name")
        fields["name"] = name
    if "email" in data:
        email = str(data["email"] or "").strip().lower()
        if not EMAIL_RE.match(email) or len(email) > 255:
            raise ApiError("invalid_email")
        other = fetch_one("SELECT id FROM users WHERE email = %s AND id <> %s", (email, g.user["id"]))
        if other:
            raise ApiError("email_taken", 409)
        fields["email"] = email
    if "language" in data:
        if data["language"] not in LANGS:
            raise ApiError("invalid_language")
        fields["language"] = data["language"]
    if "theme" in data:
        if data["theme"] not in THEMES:
            raise ApiError("invalid_theme")
        fields["theme"] = data["theme"]

    if fields:
        sets = ", ".join(f"{k} = %s" for k in fields)
        try:
            execute(f"UPDATE users SET {sets} WHERE id = %s", (*fields.values(), g.user["id"]))
        except IntegrityError:
            raise ApiError("email_taken", 409)
    user = fetch_one(f"SELECT {USER_COLS} FROM users WHERE id = %s", (g.user["id"],))
    return jsonify(user=user)


@bp.post("/password")
@login_required
def change_password():
    data = json_body()
    current = str(data.get("current_password") or "")
    new = str(data.get("new_password") or "")
    row = fetch_one("SELECT password_hash FROM users WHERE id = %s", (g.user["id"],))
    if not check_password_hash(row["password_hash"], current):
        raise ApiError("wrong_password", 400)
    if len(new) < 8 or len(new) > 128:
        raise ApiError("weak_password")
    execute("UPDATE users SET password_hash = %s WHERE id = %s", (generate_password_hash(new), g.user["id"]))
    return jsonify(ok=True)
