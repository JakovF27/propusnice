const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL nije postavljen (provjeri .env)');
}

const needsSsl = new URL(connectionString).hostname.endsWith('.render.com');

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Greška u vezi s bazom:', err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

module.exports = { query, pool };
