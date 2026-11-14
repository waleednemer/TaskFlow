import re

from flask import Blueprint, g, jsonify

from ..auth import json_body, login_required
from ..db import execute, fetch_all, fetch_one
from ..errors import ApiError

bp = Blueprint("projects", __name__, url_prefix="/api/projects")

COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
LIST_SQL = (
    "SELECT p.id, p.name, p.description, p.color, p.created_at, "
    "COUNT(t.id) AS task_count, COUNT(CASE WHEN t.status = 'done' THEN 1 END) AS done_count "
    "FROM projects p LEFT JOIN tasks t ON t.project_id = p.id "
    "WHERE p.user_id = %s {extra} GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC"
)


def parse(data, partial):
    out = {}
    if "name" in data or not partial:
        name = str(data.get("name") or "").strip()
        if not name or len(name) > 120:
            raise ApiError("invalid_name")
        out["name"] = name
    if "description" in data:
        out["description"] = str(data["description"] or "").strip()[:2000]
    if "color" in data:
        if not COLOR_RE.match(str(data["color"] or "")):
            raise ApiError("invalid_color")
        out["color"] = data["color"].lower()
    return out


def get_one(project_id):
    rows = fetch_all(LIST_SQL.format(extra="AND p.id = %s"), (g.user["id"], project_id))
    if not rows:
        raise ApiError("not_found", 404)
    return rows[0]


@bp.get("")
@login_required
def list_projects():
    return jsonify(projects=fetch_all(LIST_SQL.format(extra=""), (g.user["id"],)))


@bp.post("")
@login_required
def create_project():
    f = parse(json_body(), partial=False)
    row = execute(
        "INSERT INTO projects (user_id, name, description, color) VALUES (%s, %s, %s, %s) RETURNING id",
        (g.user["id"], f["name"], f.get("description", ""), f.get("color", "#4f46e5")),
        returning=True,
    )
    return jsonify(project=get_one(row["id"])), 201


@bp.route("/<int:project_id>", methods=["PUT", "PATCH"])
@login_required
def update_project(project_id):
    get_one(project_id)
    f = parse(json_body(), partial=True)
    if f:
        sets = ", ".join(f"{k} = %s" for k in f)
        execute(f"UPDATE projects SET {sets} WHERE id = %s AND user_id = %s", (*f.values(), project_id, g.user["id"]))
    return jsonify(project=get_one(project_id))


@bp.delete("/<int:project_id>")
@login_required
def delete_project(project_id):
    get_one(project_id)
    execute("DELETE FROM projects WHERE id = %s AND user_id = %s", (project_id, g.user["id"]))
    return jsonify(ok=True)
