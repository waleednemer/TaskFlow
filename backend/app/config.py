import os
from datetime import timedelta

from dotenv import load_dotenv

# Looks for a .env file in this directory or any parent (project root).
load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY")
    DATABASE_URL = os.environ.get("DATABASE_URL")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
    PERMANENT_SESSION_LIFETIME = timedelta(days=int(os.environ.get("SESSION_DAYS", "7")))
    MAX_CONTENT_LENGTH = 1024 * 1024  # 1 MB request bodies are plenty
