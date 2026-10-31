require('dotenv').config();

const path = require('path');
const express = require('express');
const db = require('./db');

const app = express();

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', async (req, res) => {
  const result = await db.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
    FROM passes
  `);
  const { total, active } = result.rows[0];

  res.render('home', { total, active });
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.get('/info/:id', async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(404).render('not-found');
  }

  const result = await db.query(
    'SELECT id, name, document, issued_at, status FROM passes WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).render('not-found');
  }

  const pass = result.rows[0];
  const issuedAt = pass.issued_at.toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });

  res.render('info', { pass, issuedAt });
});

app.use((req, res) => {
  res.status(404).render('not-found');
});

app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
