const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Plaid sandbox mock endpoint - replace with real Plaid keys for production
app.post('/api/create-link-token', (req, res) => {
  // In production, use the Plaid Node client:
  // const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');
  // For now return a demo response
  res.json({
    link_token: 'link-sandbox-demo-token',
    expiration: new Date(Date.now() + 3600000).toISOString(),
    request_id: 'demo-' + Date.now(),
    note: 'Add your PLAID_CLIENT_ID and PLAID_SECRET env vars for real Plaid Link'
  });
});

app.post('/api/exchange-token', (req, res) => {
  const { public_token } = req.body;
  console.log('Received public_token:', public_token);
  // In production: exchange public_token for access_token via Plaid API
  res.json({ success: true, message: 'Token exchanged (demo mode)' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NF6 Family Office Dashboard running on port ${PORT}`);
});
