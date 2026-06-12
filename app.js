const express = require("express");
const session = require("express-session");
const pg = require("pg");
const PgStore = require("connect-pg-simple")(session);
const path = require("path");
require("dotenv").config();

const app = express();

/**
 * -------------- MIDDLEWARE ----------------
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * -------------- DATABASE ----------------
 */
const pool = new pg.Pool({
  connectionString: process.env.DB_STRING,
});

// Optional: create tables
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        hash TEXT NOT NULL,
        salt TEXT NOT NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS IDX_session_expire
      ON session(expire);
    `);

    console.log("✅ PostgreSQL connected & tables ready");
  } catch (err) {
    console.error("DB error:", err);
  }
})();

/**
 * -------------- SESSION ----------------
 */
app.use(
  session({
    store: new PgStore({
      pool: pool,
      tableName: "session",
    }),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
    },
  })
);

/**
 * -------------- ROUTES ----------------
 */

// Home (session test)
app.get("/", (req, res) => {
  req.session.views = (req.session.views || 0) + 1;
  res.send(`Views: ${req.session.views}`);
  console.log(req.session);
});

// Login page
app.get("/login", (req, res) => {
  res.send("<h1>Login Page</h1>");
});

// Login handler
app.post("/login", async (req, res) => {
  try {
    const { username } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.session.userId = result.rows[0].id;

    res.json({
      success: true,
      message: "Logged in",
    });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// Register page
app.get("/register", (req, res) => {
  res.send("<h1>Register Page</h1>");
});

// Register handler
app.post("/register", async (req, res) => {
  try {
    const { username, hash, salt } = req.body;

    await pool.query(
      `INSERT INTO users (username, hash, salt)
       VALUES ($1, $2, $3)`,
      [username, hash, salt]
    );

    res.json({
      success: true,
      message: "User registered",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

/**
 * -------------- SERVER ----------------
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});