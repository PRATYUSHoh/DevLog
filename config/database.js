const { Pool } = require('pg');
require('dotenv').config();

let pool;
const dbUrl = process.env.DATABASE_URL || process.env.DB_STRING;
const isDummyLocalhost = !dbUrl || dbUrl.includes('localhost:5432') || dbUrl.includes('127.0.0.1:5432');

if (!isDummyLocalhost) {
    try {
        pool = new Pool({ connectionString: dbUrl });
        pool.on('error', (err) => {
            console.warn('[DevLog] PostgreSQL pool error:', err.message);
        });
    } catch (err) {
        console.warn('[DevLog] PostgreSQL not connected — mock active');
        pool = {
            query: async () => ({ rows: [] }),
            connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
            on: () => {}
        };
    }
} else {
    pool = {
        query: async () => ({ rows: [] }),
        connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
        on: () => {}
    };
}

module.exports = pool;
