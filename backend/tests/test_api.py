import os
import tempfile
import unittest
from datetime import date, timedelta

from app import create_app
from app.db import init_db


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "DATABASE_URL": "sqlite:///" + os.path.join(self.tmp.name, "test.db"),
        })
        with self.app.app_context():
            init_db()
        self.c = self.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def signup(self, client=None, email="alice@example.com", name="Alice", password="password123"):
        client = client or self.c
        return client.post("/api/auth/register", json={"name": name, "email": email, "password": password})

    def new_task(self, client=None, **kw):
        kw.setdefault("title", "Write docs")
        return (client or self.c).post("/api/tasks", json=kw)


class AuthTests(Base):
    def test_health(self):
        self.assertEqual(self.c.get("/api/health").get_json()["status"], "ok")

    def test_register_login_logout(self):
        r = self.signup()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.c.get("/api/auth/me").get_json()["user"]["email"], "alice@example.com")
        self.assertNotIn("password", str(r.get_json()))
        self.c.post("/api/auth/logout", json={})
        self.assertEqual(self.c.get("/api/auth/me").status_code, 401)
        bad = self.c.post("/api/auth/login", json={"email": "alice@example.com", "password": "nope"})
        self.assertEqual((bad.status_code, bad.get_json()["error"]), (401, "invalid_credentials"))
        ok = self.c.post("/api/auth/login", json={"email": "ALICE@example.com", "password": "password123"})
        self.assertEqual(ok.status_code, 200)

    def test_register_validation(self):
        self.signup()
        self.assertEqual(self.signup().get_json()["error"], "email_taken")
        self.assertEqual(self.signup(email="x", name="X").get_json()["error"], "invalid_email")
        self.assertEqual(self.signup(email="b@example.com", password="short").get_json()["error"], "weak_password")
        self.assertEqual(self.signup(email="c@example.com", name=" ").get_json()["error"], "invalid_name")

    def test_requires_login_and_json(self):
        self.assertEqual(self.c.get("/api/tasks").status_code, 401)
        self.assertEqual(self.c.get("/api/stats").status_code, 401)
        self.assertEqual(self.c.post("/api/auth/login", data="x").get_json()["error"], "json_required")
        self.assertEqual(self.c.get("/api/nothing").status_code, 404)


class TaskTests(Base):
    def setUp(self):
        super().setUp()
        self.signup()

    def test_crud(self):
        r = self.new_task(description="d", priority="high", due_date="2030-01-02")
        self.assertEqual(r.status_code, 201)
        t = r.get_json()["task"]
        self.assertEqual((t["status"], t["priority"], t["due_date"]), ("todo", "high", "2030-01-02"))
        u = self.c.patch(f"/api/tasks/{t['id']}", json={"status": "done", "title": "New"}).get_json()["task"]
        self.assertEqual((u["status"], u["title"], u["priority"]), ("done", "New", "high"))
        self.assertEqual(len(self.c.get("/api/tasks").get_json()["tasks"]), 1)
        self.assertEqual(self.c.delete(f"/api/tasks/{t['id']}").status_code, 200)
        self.assertEqual(self.c.get(f"/api/tasks/{t['id']}").status_code, 404)

    def test_validation(self):
        self.assertEqual(self.new_task(title="").get_json()["error"], "invalid_title")
        self.assertEqual(self.new_task(status="bad").get_json()["error"], "invalid_status")
        self.assertEqual(self.new_task(priority="bad").get_json()["error"], "invalid_priority")
        self.assertEqual(self.new_task(due_date="31-12-2030").get_json()["error"], "invalid_due_date")
        self.assertEqual(self.new_task(project_id=999).get_json()["error"], "invalid_project")

    def test_filters_and_sort(self):
        self.new_task(title="Buy milk", priority="low", status="todo")
        self.new_task(title="Fix bug", priority="high", status="in_progress", due_date="2030-05-01")
        self.new_task(title="Ship release", priority="medium", status="done", due_date="2030-01-01")
        get = lambda qs: [t["title"] for t in self.c.get("/api/tasks?" + qs).get_json()["tasks"]]
        self.assertEqual(get("q=MILK"), ["Buy milk"])
        self.assertEqual(get("status=done"), ["Ship release"])
        self.assertEqual(get("priority=high"), ["Fix bug"])
        self.assertEqual(get("sort=priority"), ["Fix bug", "Ship release", "Buy milk"])
        self.assertEqual(get("sort=due"), ["Ship release", "Fix bug", "Buy milk"])
        self.assertEqual(self.c.get("/api/tasks?status=zzz").status_code, 400)

    def test_users_are_isolated(self):
        t = self.new_task().get_json()["task"]
        bob = self.app.test_client()
        self.signup(bob, email="bob@example.com", name="Bob")
        self.assertEqual(bob.get("/api/tasks").get_json()["tasks"], [])
        self.assertEqual(bob.get(f"/api/tasks/{t['id']}").status_code, 404)
        self.assertEqual(bob.patch(f"/api/tasks/{t['id']}", json={"title": "x"}).status_code, 404)
        self.assertEqual(bob.delete(f"/api/tasks/{t['id']}").status_code, 404)
        self.assertEqual(len(self.c.get("/api/tasks").get_json()["tasks"]), 1)

    def test_stats(self):
        today = date.today()
        self.new_task(title="late", due_date=(today - timedelta(days=2)).isoformat())
        self.new_task(title="soon", status="in_progress", due_date=(today + timedelta(days=3)).isoformat())
        self.new_task(title="old done", status="done", due_date=(today - timedelta(days=9)).isoformat())
        s = self.c.get("/api/stats").get_json()
        self.assertEqual(s["total"], 3)
        self.assertEqual(s["by_status"], {"todo": 1, "in_progress": 1, "review": 0, "done": 1})
        self.assertEqual((s["overdue"], s["due_week"]), (1, 1))
        self.assertEqual([t["title"] for t in s["upcoming"]], ["late", "soon"])


class ProjectTests(Base):
    def setUp(self):
        super().setUp()
        self.signup()

    def test_project_lifecycle(self):
        p = self.c.post("/api/projects", json={"name": "Website", "color": "#112233"}).get_json()["project"]
        self.assertEqual((p["task_count"], p["done_count"]), (0, 0))
        self.new_task(title="a", project_id=p["id"])
        self.new_task(title="b", project_id=p["id"], status="done")
        self.new_task(title="loose")
        p = self.c.get("/api/projects").get_json()["projects"][0]
        self.assertEqual((p["task_count"], p["done_count"]), (2, 1))
        tasks = self.c.get(f"/api/tasks?project_id={p['id']}").get_json()["tasks"]
        self.assertEqual({t["title"] for t in tasks}, {"a", "b"})
        self.assertEqual(tasks[0]["project_name"], "Website")
        self.assertEqual(len(self.c.get("/api/tasks?project_id=none").get_json()["tasks"]), 1)
        u = self.c.put(f"/api/projects/{p['id']}", json={"name": "Site v2"}).get_json()["project"]
        self.assertEqual(u["name"], "Site v2")
        self.c.delete(f"/api/projects/{p['id']}")
        self.assertEqual([t["title"] for t in self.c.get("/api/tasks").get_json()["tasks"]], ["loose"])

    def test_validation_and_isolation(self):
        self.assertEqual(self.c.post("/api/projects", json={"name": ""}).get_json()["error"], "invalid_name")
        self.assertEqual(self.c.post("/api/projects", json={"name": "x", "color": "red"}).get_json()["error"], "invalid_color")
        p = self.c.post("/api/projects", json={"name": "Mine"}).get_json()["project"]
        bob = self.app.test_client()
        self.signup(bob, email="bob@example.com", name="Bob")
        self.assertEqual(bob.delete(f"/api/projects/{p['id']}").status_code, 404)
        self.assertEqual(self.new_task(bob, project_id=p["id"]).get_json()["error"], "invalid_project")


class ProfileTests(Base):
    def setUp(self):
        super().setUp()
        self.signup()

    def test_update_profile(self):
        u = self.c.put("/api/profile", json={"name": "Alicia", "language": "en", "theme": "dark"}).get_json()["user"]
        self.assertEqual((u["name"], u["language"], u["theme"]), ("Alicia", "en", "dark"))
        self.assertEqual(self.c.put("/api/profile", json={"language": "fr"}).get_json()["error"], "invalid_language")
        self.signup(self.app.test_client(), email="bob@example.com", name="Bob")
        self.assertEqual(self.c.put("/api/profile", json={"email": "bob@example.com"}).status_code, 409)

    def test_change_password(self):
        bad = self.c.post("/api/profile/password", json={"current_password": "x", "new_password": "newpassword1"})
        self.assertEqual(bad.get_json()["error"], "wrong_password")
        ok = self.c.post("/api/profile/password", json={"current_password": "password123", "new_password": "newpassword1"})
        self.assertEqual(ok.status_code, 200)
        fresh = self.app.test_client()
        self.assertEqual(fresh.post("/api/auth/login", json={"email": "alice@example.com", "password": "password123"}).status_code, 401)
        self.assertEqual(fresh.post("/api/auth/login", json={"email": "alice@example.com", "password": "newpassword1"}).status_code, 200)


if __name__ == "__main__":
    unittest.main()
