const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
const { PlaidApi, Configuration, PlaidEnvironments, Products, CountryCode } = require('plaid');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SECURITY CONFIG
// ============================================================
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAINS || 'nf6capital.com').split(',').map(d => d.trim().toLowerCase());
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS) || 8;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).map(o => o.trim());

// Google OAuth2 client (official library - verifies locally, no token-in-URL)
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// Warn if critical env vars missing
if (!GOOGLE_CLIENT_ID) console.warn('[SECURITY] GOOGLE_CLIENT_ID not set - SSO disabled');
if (!process.env.SESSION_SECRET) console.warn('[SECURITY] SESSION_SECRET not set - using random (sessions lost on restart)');

// Plaid config
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

let plaidClient = null;
if (PLAID_CLIENT_ID && PLAID_SECRET) {
  const plaidConfig = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });
  plaidClient = new PlaidApi(plaidConfig);
  console.log(`[PLAID] Client initialized (env: ${PLAID_ENV})`);
} else {
  console.warn('[PLAID] PLAID_CLIENT_ID or PLAID_SECRET not set - running in demo mode');
}

// ============================================================
// SESSION STORE (in-memory with crypto-signed IDs)
// ============================================================
const sessions = new Map();

// Plaid access tokens store (in-memory - per linked item)
const plaidItems = new Map();

// Purge expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(id);
      purged++;
    }
  }
  if (purged > 0) console.log(`[SESSION] Purged ${purged} expired sessions`);
}, 10 * 60 * 1000);

// ============================================================
// MIDDLEWARE
// ============================================================
app.set('trust proxy', 1); // Render runs behind a proxy

// Helmet - comprehensive security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://cdn.jsdelivr.net", "https://cdn.plaid.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
      frameSrc: ["https://accounts.google.com", "https://cdn.plaid.com"],
      connectSrc: ["'self'", "https://accounts.google.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrcAttr: ["'unsafe-inline'"]
    }
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// JSON body parser with size limit
app.use(express.json({ limit: '16kb' }));

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// Strict auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================
// CSRF / ORIGIN VALIDATION
// ============================================================
function validateOrigin(req, res, next) {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const host = req.get('Host');

  if (!origin && !referer) {
    return res.status(403).json({ error: 'Missing origin header' });
  }

  const requestOrigin = origin || new URL(referer).origin;

  try {
    const originHost = new URL(requestOrigin).host;
    if (originHost !== host && !ALLOWED_ORIGINS.some(o => {
      try { return new URL(o).host === originHost; } catch { return false; }
    })) {
      console.log(`[CSRF] Blocked request from origin: ${requestOrigin} (expected: ${host})`);
      return res.status(403).json({ error: 'Cross-origin request blocked' });
    }
  } catch {
    return res.status(403).json({ error: 'Invalid origin' });
  }

  next();
}

app.use('/api/', validateOrigin);

// ============================================================
// SESSION MANAGEMENT
// ============================================================
function extractSessionId(req) {
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies.split(';').find(c => c.trim().startsWith('nf6_session='));
    if (match) return match.split('=')[1].trim();
  }
  return null;
}

function getSession(req) {
  const sessionId = extractSessionId(req);
  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session || session.expiresAt < Date.now()) {
    if (sessionId) sessions.delete(sessionId);
    return null;
  }

  // NOTE: IP binding disabled - Render/Cloudflare rotates proxy IPs between requests

  // User-Agent binding (additional fingerprint check)
  const ua = req.get('User-Agent') || '';
  if (session.ua && session.ua !== ua) {
    console.log('[SECURITY] Session User-Agent mismatch - invalidating');
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not authenticated' });
  req.user = session.user;
  next();
}

function isAuthenticated(req) {
  return getSession(req) !== null;
}

function createSession(user, req) {
  // Limit sessions per user (prevent session flooding)
  let userSessionCount = 0;
  for (const [, s] of sessions) {
    if (s.user.email === user.email) userSessionCount++;
  }
  if (userSessionCount >= 5) {
    let oldest = null, oldestId = null;
    for (const [id, s] of sessions) {
      if (s.user.email === user.email && (!oldest || s.createdAt < oldest.createdAt)) {
        oldest = s; oldestId = id;
      }
    }
    if (oldestId) sessions.delete(oldestId);
  }

  const sessionId = crypto.randomBytes(48).toString('hex');
  const expiresAt = Date.now() + (SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  sessions.set(sessionId, {
    user,
    ua: req.get('User-Agent') || '',
    createdAt: Date.now(),
    expiresAt
  });

  return { sessionId, expiresAt };
}

// ============================================================
// GOOGLE TOKEN VERIFICATION
// ============================================================
async function verifyGoogleToken(idToken) {
  if (!googleClient) throw new Error('Google SSO not configured');

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  const payload = ticket.getPayload();

  if (!payload.email_verified) {
    throw new Error('Email not verified by Google');
  }

  return {
    email: payload.email,
    name: payload.name || payload.email.split('@')[0],
    picture: payload.picture,
    googleId: payload.sub,
    emailVerified: payload.email_verified
  };
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/google', authLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Invalid credential' });
    }

    const googleUser = await verifyGoogleToken(credential);

    const emailDomain = googleUser.email.split('@')[1].toLowerCase();
    if (!ALLOWED_DOMAINS.includes(emailDomain)) {
      console.log(`[AUTH] BLOCKED domain: ${emailDomain}`);
      return res.status(403).json({ error: 'Access restricted to authorized domains only.' });
    }

    const user = {
      email: googleUser.email,
      name: googleUser.name,
      picture: googleUser.picture,
      domain: emailDomain
    };

    const { sessionId, expiresAt } = createSession(user, req);

    const isSecure = req.hostname !== 'localhost';
    res.cookie('nf6_session', sessionId, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      maxAge: SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
      path: '/'
    });

    console.log(`[AUTH] Login: ${emailDomain} user from ${req.ip}`);
    res.json({
      success: true,
      user: { name: user.name, email: user.email, picture: user.picture },
      expiresAt
    });
  } catch (err) {
    console.error('[AUTH] Failed:', err.message);
    res.status(401).json({ error: 'Authentication failed.' });
  }
});

app.get('/api/auth/status', (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      name: session.user.name,
      email: session.user.email,
      picture: session.user.picture
    },
    expiresAt: session.expiresAt
  });
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = extractSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  res.clearCookie('nf6_session', {
    path: '/', httpOnly: true, secure: true, sameSite: 'strict'
  });
  res.json({ success: true });
});

app.get('/api/auth/config', (req, res) => {
  res.json({
    googleClientId: GOOGLE_CLIENT_ID || null,
    allowedDomains: ALLOWED_DOMAINS
  });
});

// ============================================================
// PAGES & STATIC FILES
// ============================================================

// Login page (public)
app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ============================================================
// PLAID INTEGRATION
// ============================================================

app.post('/api/create-link-token', requireAuth, async (req, res) => {
  try {
    if (!plaidClient) {
      return res.json({
        link_token: 'link-sandbox-demo-token',
        expiration: new Date(Date.now() + 3600000).toISOString(),
        request_id: 'demo-' + Date.now()
      });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.email },
      client_name: 'NF6 Family Office',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

    console.log('[PLAID] Link token created for', req.user.email);
    res.json({
      link_token: response.data.link_token,
      expiration: response.data.expiration,
      request_id: response.data.request_id
    });
  } catch (err) {
    console.error('[PLAID] Create link token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

app.post('/api/exchange-token', requireAuth, async (req, res) => {
  try {
    const { public_token } = req.body;
    if (!public_token || typeof public_token !== 'string') {
      return res.status(400).json({ error: 'Invalid token' });
    }

    if (!plaidClient) {
      return res.json({ success: true, message: 'Token exchanged (demo mode)' });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const item = accountsResponse.data.item;
    const accounts = accountsResponse.data.accounts;

    let institutionName = 'Unknown Institution';
    try {
      if (item.institution_id) {
        const instResponse = await plaidClient.institutionsGetById({
          institution_id: item.institution_id,
          country_codes: [CountryCode.Us],
        });
        institutionName = instResponse.data.institution.name;
      }
    } catch (e) {
      console.warn('[PLAID] Could not fetch institution name:', e.message);
    }

    plaidItems.set(itemId, {
      accessToken,
      institutionId: item.institution_id,
      institutionName,
      accounts: accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        officialName: a.official_name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        balances: a.balances,
      })),
      linkedBy: req.user.email,
      linkedAt: new Date().toISOString(),
    });

    console.log(`[PLAID] Exchanged token - ${institutionName} (${accounts.length} accounts)`);

    res.json({
      success: true,
      itemId,
      institution: institutionName,
      accounts: accounts.map(a => ({
        id: a.account_id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        balances: {
          current: a.balances.current,
          available: a.balances.available,
          currency: a.balances.iso_currency_code,
        },
      })),
    });
  } catch (err) {
    console.error('[PLAID] Exchange token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

app.get('/api/plaid/accounts', requireAuth, async (req, res) => {
  try {
    const allAccounts = [];
    for (const [itemId, item] of plaidItems) {
      if (plaidClient) {
        try {
          const response = await plaidClient.accountsGet({
            access_token: item.accessToken,
          });
          allAccounts.push({
            itemId,
            institution: item.institutionName,
            accounts: response.data.accounts.map(a => ({
              id: a.account_id,
              name: a.name,
              officialName: a.official_name,
              type: a.type,
              subtype: a.subtype,
              mask: a.mask,
              balances: {
                current: a.balances.current,
                available: a.balances.available,
                currency: a.balances.iso_currency_code,
              },
            })),
          });
        } catch (e) {
          console.error(`[PLAID] Error fetching accounts for item ${itemId}:`, e.message);
        }
      } else {
        allAccounts.push({
          itemId,
          institution: item.institutionName,
          accounts: item.accounts,
        });
      }
    }
    res.json({ items: allAccounts });
  } catch (err) {
    console.error('[PLAID] Get accounts error:', err.message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.get('/api/plaid/transactions', requireAuth, async (req, res) => {
  try {
    if (!plaidClient) {
      return res.json({ transactions: [], message: 'Demo mode - no real transactions' });
    }

    const allTransactions = [];
    const startDate = req.query.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = req.query.end || new Date().toISOString().split('T')[0];

    for (const [itemId, item] of plaidItems) {
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: 100, offset: 0 },
        });

        const txns = response.data.transactions.map(t => ({
          id: t.transaction_id,
          date: t.date,
          name: t.name || t.merchant_name,
          merchantName: t.merchant_name,
          amount: t.amount,
          currency: t.iso_currency_code,
          category: t.personal_finance_category?.primary || (t.category ? t.category[0] : 'Other'),
          accountId: t.account_id,
          accountName: item.accounts.find(a => a.id === t.account_id)?.name || 'Unknown',
          institution: item.institutionName,
          pending: t.pending,
        }));

        allTransactions.push(...txns);
      } catch (e) {
        console.error(`[PLAID] Error fetching transactions for item ${itemId}:`, e.message);
      }
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ transactions: allTransactions });
  } catch (err) {
    console.error('[PLAID] Get transactions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.delete('/api/plaid/items/:itemId', requireAuth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = plaidItems.get(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (plaidClient) {
      try {
        await plaidClient.itemRemove({ access_token: item.accessToken });
      } catch (e) {
        console.warn('[PLAID] Error removing item from Plaid:', e.message);
      }
    }

    plaidItems.delete(itemId);
    console.log(`[PLAID] Removed item: ${item.institutionName}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[PLAID] Remove item error:', err.message);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// Health check (public, no sensitive data)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authEnabled: !!GOOGLE_CLIENT_ID,
    plaid: plaidClient ? PLAID_ENV.toUpperCase() : 'DEMO MODE'
  });
});

// Dashboard (protected)
app.get('/', (req, res) => {
  if (!isAuthenticated(req)) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all
app.get('*', (req, res) => {
  if (req.path === '/login') return res.sendFile(path.join(__dirname, 'public', 'login.html'));
  if (!isAuthenticated(req)) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`NF6 Family Office Dashboard running on port ${PORT}`);
  console.log(`Auth: Google SSO ${GOOGLE_CLIENT_ID ? 'ENABLED' : 'DISABLED - set GOOGLE_CLIENT_ID'}`);
  console.log(`Plaid: ${plaidClient ? PLAID_ENV.toUpperCase() : 'DEMO MODE - set PLAID_CLIENT_ID & PLAID_SECRET'}`);
  console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  console.log(`Session expiry: ${SESSION_EXPIRY_HOURS}h | Max 5 sessions/user`);
});
