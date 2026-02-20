require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');
const { v4: uuidv4 } = require('uuid');
const { getStore, updateStore } = require('./store');
const { generateDemoData } = require('./seed-demo');

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// In production, serve the React build
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));

// Plaid client setup
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(configuration);

// ==================== COMPANY ROUTES ====================

// Get all companies
app.get('/api/companies', (req, res) => {
  const store = getStore();
  const companies = store.companies.map(c => {
    const linkedAccounts = store.linkedItems.filter(i => i.company_id === c.id);
    const accountCount = linkedAccounts.reduce((sum, item) => sum + (item.accounts ? item.accounts.length : 0), 0);
    return { ...c, accountCount, linkedItems: linkedAccounts.length };
  });
  res.json(companies);
});

// Add company
app.post('/api/companies', (req, res) => {
  const { name, type, ein } = req.body;
  const store = getStore();
  const company = {
    id: uuidv4(),
    name,
    type: type || 'LLC',
    ein: ein || '',
    createdAt: new Date().toISOString(),
  };
  store.companies.push(company);
  updateStore('companies', store.companies);
  res.json(company);
});

// Delete company
app.delete('/api/companies/:id', (req, res) => {
  const store = getStore();
  store.companies = store.companies.filter(c => c.id !== req.params.id);
  store.linkedItems = store.linkedItems.filter(i => i.company_id !== req.params.id);
  store.transactions = store.transactions.filter(t => t.company_id !== req.params.id);
  updateStore('companies', store.companies);
  updateStore('linkedItems', store.linkedItems);
  updateStore('transactions', store.transactions);
  res.json({ success: true });
});

// ==================== PLAID LINK ROUTES ====================

// Create link token
app.post('/api/plaid/create-link-token', async (req, res) => {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.body.company_id || 'default-user' },
      client_name: 'Family Office Dashboard',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error_message || error.message });
  }
});

// Exchange public token for access token
app.post('/api/plaid/exchange-token', async (req, res) => {
  try {
    const { public_token, company_id, institution } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });
    const { access_token, item_id } = response.data;

    // Get accounts for this item
    const accountsResponse = await plaidClient.accountsGet({ access_token });
    const accounts = accountsResponse.data.accounts.map(a => ({
      account_id: a.account_id,
      name: a.name,
      official_name: a.official_name,
      type: a.type,
      subtype: a.subtype,
      mask: a.mask,
      balances: a.balances,
    }));

    const store = getStore();
    const linkedItem = {
      id: uuidv4(),
      item_id,
      access_token,
      company_id,
      institution: institution || { name: 'Unknown Bank' },
      accounts,
      linkedAt: new Date().toISOString(),
    };
    store.linkedItems.push(linkedItem);
    updateStore('linkedItems', store.linkedItems);

    // Immediately sync transactions
    await syncTransactionsForItem(linkedItem);

    res.json({ success: true, accounts, item_id });
  } catch (error) {
    console.error('Error exchanging token:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error_message || error.message });
  }
});

// ==================== TRANSACTION SYNC ====================

async function syncTransactionsForItem(linkedItem) {
  try {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 2);

    const response = await plaidClient.transactionsGet({
      access_token: linkedItem.access_token,
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
      options: { count: 500, offset: 0 },
    });

    const store = getStore();
    const company = store.companies.find(c => c.id === linkedItem.company_id);
    const companyName = company ? company.name : 'Unknown';

    const newTransactions = response.data.transactions.map(t => ({
      id: t.transaction_id,
      company_id: linkedItem.company_id,
      company_name: companyName,
      account_id: t.account_id,
      account_name: linkedItem.accounts.find(a => a.account_id === t.account_id)?.name || 'Unknown',
      institution_name: linkedItem.institution?.name || 'Unknown Bank',
      date: t.date,
      name: t.name,
      merchant_name: t.merchant_name,
      amount: t.amount,
      category: t.personal_finance_category?.primary || (t.category ? t.category[0] : 'Other'),
      category_detailed: t.personal_finance_category?.detailed || (t.category ? t.category.join(' > ') : 'Other'),
      pending: t.pending,
      payment_channel: t.payment_channel,
      iso_currency_code: t.iso_currency_code || 'USD',
      // In Plaid, positive amounts are debits (money out), negative are credits (money in)
      type: t.amount > 0 ? 'expense' : 'income',
    }));

    // Remove old transactions for this item's accounts
    const accountIds = new Set(linkedItem.accounts.map(a => a.account_id));
    store.transactions = store.transactions.filter(t => !accountIds.has(t.account_id));
    store.transactions.push(...newTransactions);
    updateStore('transactions', store.transactions);

    console.log(`Synced ${newTransactions.length} transactions for ${companyName}`);
    return newTransactions.length;
  } catch (error) {
    console.error('Error syncing transactions:', error.response?.data || error.message);
    return 0;
  }
}

// Sync all transactions
app.post('/api/plaid/sync', async (req, res) => {
  const store = getStore();
  let totalSynced = 0;
  for (const item of store.linkedItems) {
    const count = await syncTransactionsForItem(item);
    totalSynced += count;
  }
  res.json({ success: true, totalSynced });
});

// ==================== DATA ROUTES ====================

// Get all transactions with filtering
app.get('/api/transactions', (req, res) => {
  const store = getStore();
  let transactions = [...store.transactions];

  // Apply filters
  if (req.query.company_id) {
    transactions = transactions.filter(t => t.company_id === req.query.company_id);
  }
  if (req.query.type) {
    transactions = transactions.filter(t => t.type === req.query.type);
  }
  if (req.query.start_date) {
    transactions = transactions.filter(t => t.date >= req.query.start_date);
  }
  if (req.query.end_date) {
    transactions = transactions.filter(t => t.date <= req.query.end_date);
  }
  if (req.query.search) {
    const s = req.query.search.toLowerCase();
    transactions = transactions.filter(t =>
      t.name.toLowerCase().includes(s) ||
      (t.merchant_name && t.merchant_name.toLowerCase().includes(s)) ||
      t.company_name.toLowerCase().includes(s)
    );
  }
  if (req.query.min_amount) {
    transactions = transactions.filter(t => Math.abs(t.amount) >= parseFloat(req.query.min_amount));
  }
  if (req.query.max_amount) {
    transactions = transactions.filter(t => Math.abs(t.amount) <= parseFloat(req.query.max_amount));
  }
  if (req.query.category) {
    transactions = transactions.filter(t => t.category === req.query.category);
  }

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const total = transactions.length;
  const paginated = transactions.slice((page - 1) * limit, page * limit);

  res.json({
    transactions: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// Get all accounts with balances
app.get('/api/accounts', async (req, res) => {
  const store = getStore();
  const allAccounts = [];

  for (const item of store.linkedItems) {
    try {
      const response = await plaidClient.accountsGet({ access_token: item.access_token });
      const company = store.companies.find(c => c.id === item.company_id);
      for (const account of response.data.accounts) {
        allAccounts.push({
          ...account,
          company_id: item.company_id,
          company_name: company?.name || 'Unknown',
          institution_name: item.institution?.name || 'Unknown Bank',
        });
      }
    } catch (error) {
      console.error('Error fetching accounts for item:', item.item_id, error.message);
      // Return cached accounts if API fails
      const company = store.companies.find(c => c.id === item.company_id);
      for (const account of item.accounts) {
        allAccounts.push({
          ...account,
          company_id: item.company_id,
          company_name: company?.name || 'Unknown',
          institution_name: item.institution?.name || 'Unknown Bank',
        });
      }
    }
  }

  res.json(allAccounts);
});

// ==================== DASHBOARD / ANALYTICS ROUTES ====================

app.get('/api/dashboard', (req, res) => {
  const store = getStore();
  const transactions = store.transactions;
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  // Current month transactions
  const thisMonthTxns = transactions.filter(t => t.date.startsWith(thisMonth));
  const lastMonthTxns = transactions.filter(t => t.date.startsWith(lastMonth));

  // In Plaid: positive = money out (expense), negative = money in (income)
  const totalIncome = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  const monthIncome = thisMonthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const monthExpenses = thisMonthTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  const lastMonthIncome = lastMonthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const lastMonthExpenses = lastMonthTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

  // Monthly cash flow for chart (last 12 months)
  const monthlyCashFlow = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = d.toISOString().slice(0, 7);
    const monthTxns = transactions.filter(t => t.date.startsWith(monthKey));
    const income = monthTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const expenses = monthTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    monthlyCashFlow.push({
      month: monthKey,
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    });
  }

  // Expenses by category
  const categoryMap = {};
  transactions.filter(t => t.amount > 0).forEach(t => {
    const cat = t.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
  });
  const expensesByCategory = Object.entries(categoryMap)
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // Per-company summary
  const companySummaries = store.companies.map(c => {
    const compTxns = transactions.filter(t => t.company_id === c.id);
    const income = compTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const expenses = compTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
      transactionCount: compTxns.length,
    };
  });

  // Recent transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  res.json({
    kpis: {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netCashFlow: Math.round((totalIncome - totalExpenses) * 100) / 100,
      monthIncome: Math.round(monthIncome * 100) / 100,
      monthExpenses: Math.round(monthExpenses * 100) / 100,
      monthNet: Math.round((monthIncome - monthExpenses) * 100) / 100,
      lastMonthIncome: Math.round(lastMonthIncome * 100) / 100,
      lastMonthExpenses: Math.round(lastMonthExpenses * 100) / 100,
      totalCompanies: store.companies.length,
      totalAccounts: store.linkedItems.reduce((sum, i) => sum + i.accounts.length, 0),
      totalTransactions: transactions.length,
    },
    monthlyCashFlow,
    expensesByCategory,
    companySummaries,
    recentTransactions,
  });
});

// Cash flow report
app.get('/api/cashflow', (req, res) => {
  const store = getStore();
  let transactions = [...store.transactions];

  if (req.query.company_id) {
    transactions = transactions.filter(t => t.company_id === req.query.company_id);
  }

  // Group by week
  const weeklyData = {};
  transactions.forEach(t => {
    const d = new Date(t.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { week: weekKey, income: 0, expenses: 0, transactions: 0 };
    }
    if (t.amount < 0) {
      weeklyData[weekKey].income += Math.abs(t.amount);
    } else {
      weeklyData[weekKey].expenses += t.amount;
    }
    weeklyData[weekKey].transactions++;
  });

  const weekly = Object.values(weeklyData)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map(w => ({
      ...w,
      income: Math.round(w.income * 100) / 100,
      expenses: Math.round(w.expenses * 100) / 100,
      net: Math.round((w.income - w.expenses) * 100) / 100,
    }));

  // Running balance
  let runningBalance = 0;
  const withBalance = weekly.map(w => {
    runningBalance += w.net;
    return { ...w, runningBalance: Math.round(runningBalance * 100) / 100 };
  });

  res.json({ weekly: withBalance });
});

// Audit log - all transactions for export/audit
app.get('/api/audit', (req, res) => {
  const store = getStore();
  let transactions = [...store.transactions];

  // Sort by date
  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Summary stats
  const byCompany = {};
  transactions.forEach(t => {
    if (!byCompany[t.company_name]) {
      byCompany[t.company_name] = { income: 0, expenses: 0, count: 0 };
    }
    if (t.amount < 0) {
      byCompany[t.company_name].income += Math.abs(t.amount);
    } else {
      byCompany[t.company_name].expenses += t.amount;
    }
    byCompany[t.company_name].count++;
  });

  res.json({
    transactions,
    summary: byCompany,
    exportDate: new Date().toISOString(),
    totalRecords: transactions.length,
  });
});

// Categories
app.get('/api/categories', (req, res) => {
  const store = getStore();
  res.json(store.categories);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== DEMO DATA ====================

// Seed demo data (generates realistic multi-company transaction data)
app.post('/api/seed-demo', (req, res) => {
  const demo = generateDemoData();
  updateStore('companies', demo.companies);
  updateStore('linkedItems', demo.linkedItems);
  updateStore('transactions', demo.transactions);
  res.json({
    success: true,
    companies: demo.companies.length,
    accounts: demo.linkedItems.reduce((s, i) => s + i.accounts.length, 0),
    transactions: demo.transactions.length,
  });
});

// Reset all data
app.post('/api/reset', (req, res) => {
  updateStore('companies', []);
  updateStore('linkedItems', []);
  updateStore('transactions', []);
  res.json({ success: true });
});

// Serve React app for all non-API routes (must be after all API routes)
const fs = require('fs');
app.get('*', (req, res) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('API is running. Build the React client to serve the frontend.');
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => {
  // Auto-seed demo data if store is empty
  const store = getStore();
  if (store.companies.length === 0) {
    console.log('  No data found - seeding demo data...');
    const demo = generateDemoData();
    updateStore('companies', demo.companies);
    updateStore('linkedItems', demo.linkedItems);
    updateStore('transactions', demo.transactions);
    console.log(`  Seeded: ${demo.companies.length} companies, ${demo.transactions.length} transactions`);
  }

  console.log(`\n  Family Office Financial Dashboard - API Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Plaid Environment: ${process.env.PLAID_ENV || 'sandbox'}`);
  console.log(`  Companies: ${getStore().companies.length} | Transactions: ${getStore().transactions.length}\n`);
});
