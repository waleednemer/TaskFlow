from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, g, jsonify, request

from ..auth import json_body, login_required
from ..db import execute, fetch_all, fetch_one
from ..errors import ApiError

bp = Blueprint("tasks", __name__, url_prefix="/api")

STATUSES = ("todo", "in_progress", "review", "done")
PRIORITIES = ("low", "medium", "high")
TASK_SELECT = (
    "SELECT t.*, p.name AS project_name, p.color AS project_color "
    "FROM tasks t LEFT JOIN projects p ON p.id = t.project_id"
)
SORTS = {
    "newest": "t.created_at DESC, t.id DESC",
    "due": "(t.due_date IS NULL), t.due_date ASC, t.id DESC",
    "priority": "CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.id DESC",
}


def parse_task(data, partial):
    out = {}
    if "title" in data or not partial:
        title = str(data.get("title") or "").strip()
        if not title or len(title) > 200:
            raise ApiError("invalid_title")
        out["title"] = title
    if "description" in data:
        out["description"] = str(data["description"] or "").strip()[:5000]
    if "status" in data:
        if data["status"] not in STATUSES:
            raise ApiError("invalid_status")
        out["status"] = data["status"]
    if "priority" in data:
        if data["priority"] not in PRIORITIES:
            raise ApiError("invalid_priority")
        out["priority"] = data["priority"]
    if "due_date" in data:
        v = data["due_date"]
        if v in (None, ""):
            out["due_date"] = None
        else:
            try:
                out["due_date"] = date.fromisoformat(str(v)).isoformat()
            except ValueError:
                raise ApiError("invalid_due_date")
    if "project_id" in data:
        v = data["project_id"]
        if v in (None, ""):
            out["project_id"] = None
        else:
            try:
                pid = int(v)
            except (TypeError, ValueError):
                raise ApiError("invalid_project")
            if not fetch_one("SELECT id FROM projects WHERE id = %s AND user_id = %s", (pid, g.user["id"])):
                raise ApiError("invalid_project")
            out["project_id"] = pid
    return out


def get_task(task_id):
    row = fetch_one(TASK_SELECT + " WHERE t.id = %s AND t.user_id = %s", (task_id, g.user["id"]))
    if not row:
        raise ApiError("not_found", 404)
    return row


@bp.get("/tasks")
@login_required
def list_tasks():
    args = request.args
    where, params = ["t.user_id = %s"], [g.user["id"]]

    q = (args.get("q") or "").strip().lower()
    if q:
        where.append("(LOWER(t.title) LIKE %s OR LOWER(t.description) LIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    if args.get("status"):
        if args["status"] not in STATUSES:
            raise ApiError("invalid_status")
        where.append("t.status = %s")
        params.append(args["status"])
    if args.get("priority"):
        if args["priority"] not in PRIORITIES:
            raise ApiError("invalid_priority")
        where.append("t.priority = %s")
        params.append(args["priority"])
    pid = args.get("project_id")
    if pid == "none":
        where.append("t.project_id IS NULL")
    elif pid:
        try:
            params.append(int(pid))
        except ValueError:
            raise ApiError("invalid_project")
        where.append("t.project_id = %s")

    order = SORTS.get(args.get("sort") or "newest")
    if order is None:
        raise ApiError("invalid_sort")
    rows = fetch_all(f"{TASK_SELECT} WHERE {' AND '.join(where)} ORDER BY {order}", params)
    return jsonify(tasks=rows)


@bp.post("/tasks")
@login_required
def create_task():
    f = parse_task(json_body(), partial=False)
    row = execute(
        "INSERT INTO tasks (user_id, project_id, title, description, status, priority, due_date) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
        (
            g.user["id"], f.get("project_id"), f["title"], f.get("description", ""),
            f.get("status", "todo"), f.get("priority", "medium"), f.get("due_date"),
        ),
        returning=True,
    )
    return jsonify(task=get_task(row["id"])), 201


@bp.get("/tasks/<int:task_id>")
@login_required
def read_task(task_id):
    return jsonify(task=get_task(task_id))


@bp.route("/tasks/<int:task_id>", methods=["PUT", "PATCH"])
@login_required
def update_task(task_id):
    get_task(task_id)
    f = parse_task(json_body(), partial=True)
    if f:
        f["updated_at"] = datetime.now(timezone.utc).isoformat()
        sets = ", ".join(f"{k} = %s" for k in f)
        execute(f"UPDATE tasks SET {sets} WHERE id = %s AND user_id = %s", (*f.values(), task_id, g.user["id"]))
    return jsonify(task=get_task(task_id))


@bp.delete("/tasks/<int:task_id>")
@login_required
def delete_task(task_id):
    get_task(task_id)
    execute("DELETE FROM tasks WHERE id = %s AND user_id = %s", (task_id, g.user["id"]))
    return jsonify(ok=True)


@bp.get("/stats")
@login_required
def stats():
    uid = g.user["id"]
    today = date.today()
    by_status = {s: 0 for s in STATUSES}
    for r in fetch_all("SELECT status, COUNT(*) AS n FROM tasks WHERE user_id = %s GROUP BY status", (uid,)):
        by_status[r["status"]] = int(r["n"])
    by_priority = {p: 0 for p in PRIORITIES}
    for r in fetch_all(
        "SELECT priority, COUNT(*) AS n FROM tasks WHERE user_id = %s AND status <> 'done' GROUP BY priority", (uid,)
    ):
        by_priority[r["priority"]] = int(r["n"])
    open_clause = "user_id = %s AND status <> 'done' AND due_date IS NOT NULL"
    overdue = fetch_one(f"SELECT COUNT(*) AS n FROM tasks WHERE {open_clause} AND due_date < %s", (uid, today.isoformat()))
    week = fetch_one(
        f"SELECT COUNT(*) AS n FROM tasks WHERE {open_clause} AND due_date >= %s AND due_date <= %s",
        (uid, today.isoformat(), (today + timedelta(days=7)).isoformat()),
    )
    projects = fetch_one("SELECT COUNT(*) AS n FROM projects WHERE user_id = %s", (uid,))
    upcoming = fetch_all(
        f"{TASK_SELECT} WHERE t.user_id = %s AND t.status <> 'done' AND t.due_date IS NOT NULL "
        "ORDER BY t.due_date ASC, t.id ASC LIMIT 5",
        (uid,),
    )
    return jsonify(
        total=sum(by_status.values()),
        by_status=by_status,
        by_priority=by_priority,
        overdue=int(overdue["n"]),
        due_week=int(week["n"]),
        projects=int(projects["n"]),
        upcoming=upcoming,
    )
