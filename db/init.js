require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/db');

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await db.query(sql);
    console.log('Shema je izvršena – tablica "passes" postoji.');
  } finally {
    await db.pool.end();
  }
}

main().catch((err) => {
  console.error('Greška:', err.message);
  process.exit(1);
});
