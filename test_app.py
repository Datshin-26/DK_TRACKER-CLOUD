import tempfile
import unittest
from pathlib import Path

from app import create_app


class StateApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        app = create_app(Path(self.temp_dir.name) / "test.db")
        app.config["TESTING"] = True
        self.client = app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_state_starts_empty(self):
        response = self.client.get("/api/state")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json["state"])

    def test_state_can_be_saved_and_loaded(self):
        state = {"habits": [{"id": "h1", "name": "Read"}], "xp": 50}
        saved = self.client.put("/api/state", json=state)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json, {"saved": True})

        loaded = self.client.get("/api/state")
        self.assertEqual(loaded.json["state"], state)

    def test_state_must_be_a_json_object(self):
        response = self.client.put("/api/state", json=["invalid"])
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json)

    def test_root_serves_the_frontend(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"DK-HAB_TRACK", response.data)
        response.close()


if __name__ == "__main__":
    unittest.main()
