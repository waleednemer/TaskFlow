"""Tiny data-access layer.

Production uses PostgreSQL (psycopg2). SQLite is supported only so the test
suite can run anywhere without a database server. SQL is written with %s
placeholders and adapted for SQLite automatically.
"""
import sqlite3
from datetime import date, datetime
from pathlib import Path

import click
from flask import current_app, g

try:
    import psycopg2
    import psycopg2.extras
    IntegrityError = (sqlite3.IntegrityError, psycopg2.IntegrityError)
except ImportError:  # pragma: no cover - only when psycopg2 is missing (tests)
    psycopg2 = None
    IntegrityError = (sqlite3.IntegrityError,)


def _is_sqlite():
    return current_app.config["DATABASE_URL"].startswith("sqlite")


def get_db():
    if "db" not in g:
        url = current_app.config["DATABASE_URL"]
        if _is_sqlite():
            conn = sqlite3.connect(url.replace("sqlite:///", "", 1))
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
        else:
            if psycopg2 is None:
                raise RuntimeError("psycopg2 is required for PostgreSQL")
            conn = psycopg2.connect(url, cursor_factory=psycopg2.extras.RealDictCursor)
        g.db = conn
    return g.db


def _adapt(sql):
    return sql.replace("%s", "?") if _is_sqlite() else sql


def serialize(row):
    return {k: (v.isoformat() if isinstance(v, (date, datetime)) else v) for k, v in dict(row).items()}


def fetch_all(sql, params=()):
    cur = get_db().cursor()
    try:
        cur.execute(_adapt(sql), tuple(params))
        return [serialize(r) for r in cur.fetchall()]
    finally:
        cur.close()


def fetch_one(sql, params=()):
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def execute(sql, params=(), returning=False):
    """Run a write. With returning=True the SQL must end in RETURNING ... and the row is returned."""
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute(_adapt(sql), tuple(params))
        row = cur.fetchone() if returning else None
        count = cur.rowcount
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
    if returning:
        return serialize(row) if row else None
    return count


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_db():
    schema = "sqlite.sql" if _is_sqlite() else "postgres.sql"
    sql = (Path(__file__).resolve().parent.parent / "db" / schema).read_text(encoding="utf-8")
    conn = get_db()
    if _is_sqlite():
        conn.executescript(sql)
    else:
        cur = conn.cursor()
        cur.execute(sql)
        conn.commit()
        cur.close()


def init_app(app):
    app.teardown_appcontext(close_db)

    @app.cli.command("init-db")
    def init_db_command():
        """Create tables (safe to run repeatedly)."""
        init_db()
        click.echo("Database initialised.")
