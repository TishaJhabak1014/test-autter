// PLANTED-BUG FILE: add this on a branch (e.g. feature/bugs) and open a PR.
// Every problem here is deliberate, for testing a code reviewer.
const express = require("express");
const fs = require("fs/promises");
const Database = require("better-sqlite3");

const router = express.Router();
const db = new Database(":memory:");
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)");

// BUG 1 (security): hardcoded credential. This is a fake key.
const PAYMENTS_API_KEY = "sk_test_FAKE1234567890abcdefGHIJ";

// BUG 2 (security): SQL injection via string concatenation of user input.
router.get("/users/search", (req, res) => {
  const name = req.query.name;
  const rows = db.prepare("SELECT * FROM users WHERE name = '" + name + "'").all();
  res.json(rows);
});

// BUG 3 (logic): off-by-one. `<=` reads one past the end, so the
// last element is `undefined` and the result has an extra entry.
function paginate(items, page, pageSize) {
  const start = page * pageSize;
  const out = [];
  for (let i = start; i <= start + pageSize; i++) {
    out.push(items[i]);
  }
  return out;
}

router.get("/users", (req, res) => {
  const all = db.prepare("SELECT * FROM users").all();
  const page = Number(req.query.page || 0);
  res.json(paginate(all, page, 10));
});

// BUG 4 (subtle): missing `await` plus an empty catch. If the audit write
// fails, the rejection is unhandled and the try/catch can never see it.
async function logAudit(entry) {
  await fs.appendFile("/var/log/app-audit.log", JSON.stringify(entry) + "\n");
}

router.post("/users", (req, res) => {
  const { name, email } = req.body;
  db.prepare("INSERT INTO users (name, email) VALUES (?, ?)").run(name, email);
  try {
    logAudit({ action: "create_user", name, key: PAYMENTS_API_KEY });
  } catch (e) {
    // ignore
  }
  res.status(201).json({ ok: true });
});

module.exports = router;
