from flask import jsonify, request
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    """Raised by routes; `code` is a stable machine-readable string the UI translates."""

    def __init__(self, code, status=400):
        super().__init__(code)
        self.code = code
        self.status = status


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def api_error(e):
        return jsonify(error=e.code), e.status

    @app.errorhandler(HTTPException)
    def http_error(e):
        if request.path.startswith("/api/"):
            codes = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 413: "too_large"}
            return jsonify(error=codes.get(e.code, "server_error")), e.code
        return e

    if not app.debug:
        @app.errorhandler(Exception)
        def unhandled(e):
            app.logger.exception(e)
            if request.path.startswith("/api/"):
                return jsonify(error="server_error"), 500
            return "Internal Server Error", 500
