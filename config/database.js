const { Pool } = require('pg');
require('dotenv').config();

/**
 * -------------- DATABASE ----------------
 */
/**
 * Connect to PostgreSQL using the connection string in the `.env` file.
 * Add this to your .env:
 * DB_STRING=postgresql://<user>:<password>@localhost:5432/database_name
 */
const pool = new Pool({
    connectionString: process.env.DB_STRING,
});

// Creates the users table if it doesn't exist
const initDB = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            hash TEXT NOT NULL,
            salt TEXT NOT NULL
        );
    `);
};

initDB().catch(console.error);

module.exports = pool;