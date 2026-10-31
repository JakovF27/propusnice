require('dotenv').config();

const path = require('path');
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const db = require('./db');

const app = express();

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, 'public')));

app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    secret: process.env.AUTH0_SECRET,
    authorizationParams: {
      response_type: 'code',
      scope: 'openid profile email',
    },
  })
);

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.oidc.isAuthenticated();
  res.locals.user = req.oidc.user;
  next();
});

function formatDate(date) {
  return date.toLocaleString('hr-HR', { timeZone: 'Europe/Zagreb' });
}

app.get('/', async (req, res) => {
  const result = await db.query(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active
    FROM passes
  `);
  const { total, active } = result.rows[0];

  let passes = [];
  if (req.oidc.isAuthenticated()) {
    const list = await db.query(
      'SELECT id, name, document, issued_at, status FROM passes ORDER BY issued_at DESC'
    );
    passes = list.rows.map((pass) => ({ ...pass, issuedAt: formatDate(pass.issued_at) }));
  }

  res.render('home', { total, active, passes });
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

  res.render('info', { pass, issuedAt: formatDate(pass.issued_at) });
});

app.post('/admin/passes/:id/cancel', requiresAuth(), async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(404).render('not-found');
  }

  const result = await db.query(
    "UPDATE passes SET status = 'CANCELLED' WHERE id = $1 RETURNING id",
    [id]
  );

  if (result.rowCount === 0) {
    return res.status(404).render('not-found');
  }

  res.redirect('/');
});

app.post('/admin/passes/:id/delete', requiresAuth(), async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(404).render('not-found');
  }

  const result = await db.query('DELETE FROM passes WHERE id = $1', [id]);

  if (result.rowCount === 0) {
    return res.status(404).render('not-found');
  }

  res.redirect('/');
});

app.use((req, res) => {
  res.status(404).render('not-found');
});

app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
