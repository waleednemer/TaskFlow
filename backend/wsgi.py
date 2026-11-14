"""WSGI entry point (gunicorn wsgi:app / flask --app wsgi ...)."""
from app import create_app

app = create_app()
