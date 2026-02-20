require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const store = require('./store');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- AUTH MIDDLEWARE ---
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Not authorized - no token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = store.verifyToken(token);
    req.user = store.findUserById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized - invalid token' });
  }
};

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (store.findUserByEmail(email)) return res.status(400).json({ message: 'Email already registered' });

    const user = await store.createUser({ name, email, password, role: 'owner' });
    const token = store.generateToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = store.findUserByEmail(email);
    if (!user || !(await store.comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = store.generateToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', protect, (req, res) => {
  const user = req.user;
  res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
});

// ============================================================
// DASHBOARD ROUTES
// ============================================================
app.get('/api/dashboard', protect, (req, res) => {
  const summary = store.getDashboardSummary();
  const topAccounts = store.getTopAccounts(10);
  const entities = store.getEntitiesWithSummary();
  const institutions = store.getInstitutionsWithSummary();

  res.json({
    summary,
    topAccounts,
    entities,
    institutions
  });
});

// ============================================================
// ENTITY ROUTES
// ============================================================
app.get('/api/entities', protect, (req, res) => {
  res.json(store.getEntitiesWithSummary());
});

app.get('/api/entities/:id', protect, (req, res) => {
  const entity = store.getEntityById(req.params.id);
  if (!entity) return res.status(404).json({ message: 'Entity not found' });

  const summary = store.getEntitySummary(req.params.id);
  const accounts = store.getAccounts({ entity: req.params.id }).map(store.populateAccount);

  res.json({ ...entity, ...summary, accounts });
});

// ============================================================
// INSTITUTION ROUTES
// ============================================================
app.get('/api/institutions', protect, (req, res) => {
  res.json(store.getInstitutionsWithSummary());
});

app.get('/api/institutions/:id', protect, (req, res) => {
  const inst = store.getInstitutionById(req.params.id);
  if (!inst) return res.status(404).json({ message: 'Institution not found' });

  const summary = store.getInstitutionSummary(req.params.id);
  const accounts = store.getAccounts({ institution: req.params.id }).map(store.populateAccount);

  res.json({ ...inst, ...summary, accounts });
});

// ============================================================
// ACCOUNT ROUTES
// ============================================================
app.get('/api/accounts', protect, (req, res) => {
  const filter = {};
  if (req.query.entity) filter.entity = req.query.entity;
  if (req.query.institution) filter.institution = req.query.institution;
  if (req.query.currency) filter.currency = req.query.currency;
  if (req.query.accountType) filter.accountType = req.query.accountType;

  const accounts = store.getAccounts(filter).map(store.populateAccount);
  res.json(accounts);
});

app.get('/api/accounts/:id', protect, (req, res) => {
  const acct = store.getAccountById(req.params.id);
  if (!acct) return res.status(404).json({ message: 'Account not found' });
  res.json(store.populateAccount(acct));
});

// ============================================================
// EXCHANGE RATES
// ============================================================
app.get('/api/exchange-rates', protect, (req, res) => {
  res.json(store.getExchangeRates());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'in-memory', app: 'MN Family Office Dashboard', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// ============================================================
// SEED DATA ON STARTUP
// ============================================================
(async () => {
  await store.createUser({
    name: 'Michael Nguyen',
    email: 'michael@nf6familyoffice.com',
    password: 'NF6Admin2026!',
    role: 'owner'
  });

  console.log('MN Family Office Dashboard - Data loaded');
  console.log(`  ${store.getEntities().length} entities | ${store.getInstitutions().length} institutions | ${store.getAccounts().length} accounts`);
  console.log('Login: michael@nf6familyoffice.com / NF6Admin2026!');
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MN Family Office API running on http://localhost:${PORT}`);
});

module.exports = app;
