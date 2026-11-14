from functools import wraps

from flask import g, request, session

from .db import fetch_one
from .errors import ApiError


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ApiError("json_required", 400)
    return data


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        uid = session.get("user_id")
        user = None
        if uid:
            user = fetch_one("SELECT id, name, email, language, theme FROM users WHERE id = %s", (uid,))
        if not user:
            session.clear()
            raise ApiError("unauthorized", 401)
        g.user = user
        return view(*args, **kwargs)

    return wrapped
