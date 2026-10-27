import json
import sqlite3
from contextlib import closing
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = BASE_DIR / "habit_tracker.db"


def create_app(database_path=DATABASE_PATH):
    app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
    app.config["DATABASE"] = str(database_path)
    app.config["MAX_CONTENT_LENGTH"] = 1_000_000

    def connect():
        connection = sqlite3.connect(app.config["DATABASE"])
        connection.execute(
            "CREATE TABLE IF NOT EXISTS app_state "
            "(id INTEGER PRIMARY KEY CHECK (id = 1), state_json TEXT NOT NULL)"
        )
        return connection

    @app.get("/")
    def index():
        return send_from_directory(BASE_DIR, "index.html")

    @app.get("/api/state")
    def get_state():
        with closing(connect()) as connection:
            row = connection.execute(
                "SELECT state_json FROM app_state WHERE id = 1"
            ).fetchone()
        return jsonify(state=json.loads(row[0]) if row else None)

    @app.put("/api/state")
    def put_state():
        state = request.get_json(silent=True)
        if not isinstance(state, dict):
            return jsonify(error="Request body must be a JSON object."), 400

        with closing(connect()) as connection:
            with connection:
                connection.execute(
                    "INSERT INTO app_state (id, state_json) VALUES (1, ?) "
                    "ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json",
                    (json.dumps(state),),
                )
        return jsonify(saved=True)

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
