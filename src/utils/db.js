/**
 * PostgreSQL Database Client
 * Direct connection using pg (node-postgres)
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ Missing DATABASE_URL in .env file');
    console.error('   Please set DATABASE_URL=postgresql://user:password@host:port/database');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

// Test connection on startup
pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL connected'))
    .catch(err => {
        console.error('❌ PostgreSQL connection error:', err.message);
        process.exit(1);
    });

/**
 * Execute a query with parameterized values
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Object} Query result { rows, rowCount }
 */
export const query = async (text, params) => {
    return pool.query(text, params);
};

/**
 * Get a client from the pool (for transactions)
 * @returns {Object} pg Client
 */
export const getClient = async () => {
    return pool.connect();
};

export default pool;
