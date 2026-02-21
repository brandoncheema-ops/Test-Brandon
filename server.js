const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { OAuth2Client } = require('google-auth-library');
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

// ============================================================
// SESSION STORE (in-memory with crypto-signed IDs)
// ============================================================
const sessions = new Map();

// Purge expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) { sessions.delete(id); purged++; }
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
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Required for Google Sign-In popup
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// JSON body parser with size limit
app.use(express.json({ limit: '16kb' }));

// Global rate limiter
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });
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
  // Only enforce on state-changing methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

  const origin = req.get('Origin');
  const referer = req.get('Referer');
  const host = req.get('Host');

  // Must have Origin or Referer header
  if (!origin && !referer) {
    return res.status(403).json({ error: 'Missing origin header' });
  }

  // Validate Origin matches Host
  const requestOrigin = origin || new URL(referer).origin;
  const expectedOrigins = [`https://${host}`, `http://${host}`, ...ALLOWED_ORIGINS];

  try {
    const originHost = new URL(requestOrigin).host;
    if (originHost !== host && !ALLOWED_ORIGINS.some(o => { try { return new URL(o).host === originHost; } catch { return false; } })) {
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

  // IP binding enforcement (session hijacking protection)
  const clientIp = req.ip || req.connection.remoteAddress;
  if (session.ip && session.ip !== clientIp) {
    console.log(`[SECURITY] Session IP mismatch: expected ${session.ip}, got ${clientIp}`);
    sessions.delete(sessionId);
    return null;
  }

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
    // Evict oldest session for this user
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
    ip: req.ip || req.connection.remoteAddress,
    ua: req.get('User-Agent') || '',
    createdAt: Date.now(),
    expiresAt
  });

  return { sessionId, expiresAt };
}
// ============================================================
// GOOGLE TOKEN VERIFICATION (official library - local verification)
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

    // Verify with Google (local crypto verification - no token in URL)
    const googleUser = await verifyGoogleToken(credential);

    // Domain restriction - strict enforcement
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
      httpOnly: true,       // XSS protection - JS cannot read cookie
      secure: isSecure,     // HTTPS only in production
      sameSite: 'strict',   // CSRF protection
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
    user: { name: session.user.name, email: session.user.email, picture: session.user.picture },
    expiresAt: session.expiresAt
  });
});

app.post('/api/auth/logout', (req, res) => {
  const sessionId = extractSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  res.clearCookie('nf6_session', { path: '/', httpOnly: true, secure: true, sameSite: 'strict' });
  res.json({ success: true });
});

app.get('/api/auth/config', (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID || null, allowedDomains: ALLOWED_DOMAINS });
});
// ============================================================
// PAGES & STATIC FILES
// ============================================================
// Login page (public)
app.get('/login', (req, res) => {
  if (isAuthenticated(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Plaid endpoints (protected)
app.post('/api/create-link-token', requireAuth, (req, res) => {
  res.json({
    link_token: 'link-sandbox-demo-token',
    expiration: new Date(Date.now() + 3600000).toISOString(),
    request_id: 'demo-' + Date.now()
  });
});

app.post('/api/exchange-token', requireAuth, (req, res) => {
  const { public_token } = req.body;
  if (!public_token || typeof public_token !== 'string') {
    return res.status(400).json({ error: 'Invalid token' });
  }
  // In production: exchange with Plaid server
  res.json({ success: true, message: 'Token exchanged (demo mode)' });
});

// Health check (public, no sensitive data)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), authEnabled: !!GOOGLE_CLIENT_ID });
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
  console.log(`Allowed domains: ${ALLOWED_DOMAINS.join(', ')}`);
  console.log(`Session expiry: ${SESSION_EXPIRY_HOURS}h | Max 5 sessions/user`);
});
