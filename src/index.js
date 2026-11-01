require('dotenv').config();

const path = require('path');
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const { auth: jwtAuth, requiredScopes } = require('express-oauth2-jwt-bearer');
const QRCode = require('qrcode');
const db = require('./db');

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

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

const checkJwt = jwtAuth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  tokenSigningAlg: 'RS256',
});

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

app.get('/passes/:id', checkJwt, requiredScopes('read:passes'), async (req, res) => {
  const { id } = req.params;

  if (!UUID_REGEX.test(id)) {
    return res.status(404).json({ error: 'not_found' });
  }

  const result = await db.query(
    'SELECT id, name, document, issued_at, status FROM passes WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'not_found' });
  }

  res.json(toPassJson(result.rows[0]));
});

app.post('/passes', checkJwt, requiredScopes('create:passes'), express.json(), async (req, res) => {
  const { name, document } = req.body ?? {};

  if (!isNonEmptyString(name) || !isNonEmptyString(document)) {
    return res.status(400).json({
      error: 'bad_request',
      message: 'Polja "name" i "document" su obavezna i ne smiju biti prazna.',
    });
  }

  const result = await db.query(
    'INSERT INTO passes (name, document) VALUES ($1, $2) RETURNING id',
    [name.trim(), document.trim()]
  );
  const { id } = result.rows[0];

  const qrPng = await QRCode.toBuffer(`${BASE_URL}/info/${id}`, { type: 'png', width: 300 });

  res
    .status(201)
    .location(`${BASE_URL}/passes/${id}`)
    .type('image/png')
    .send(qrPng);
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function toPassJson(pass) {
  return {
    id: pass.id,
    name: pass.name,
    document: pass.document,
    issuedAt: pass.issued_at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    status: pass.status,
  };
}

app.use((req, res) => {
  res.status(404).render('not-found');
});

app.use((err, req, res, next) => {
  if (err.status >= 400 && err.status < 500) {
    if (err.headers) {
      res.set(err.headers);
    }
    const fallback = err.status === 401 ? 'unauthorized' : 'bad_request';
    return res.status(err.status).json({ error: err.code || err.type || fallback, message: err.message });
  }

  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  console.log(`Server radi na http://localhost:${PORT}`);
});
