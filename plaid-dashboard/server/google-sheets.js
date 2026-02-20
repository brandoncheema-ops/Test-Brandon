// Google Sheets backup module
// Uses Google Service Account to write financial data to Google Sheets
const { google } = require('googleapis');
const { getStore } = require('./store');

// Initialize Google Sheets API with service account credentials
function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  if (!credentials.client_email) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured. Add service account JSON to .env');
  }
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  );
  return auth;
}

function getSheetsClient(auth) {
  return google.sheets({ version: 'v4', auth });
}

function getDriveClient(auth) {
  return google.drive({ version: 'v3', auth });
}

// Create a new Google Sheet and return its ID + URL
async function createSpreadsheet(title) {
  const auth = getAuthClient();
  const sheets = getSheetsClient(auth);

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Dashboard Summary', index: 0 } },
        { properties: { title: 'Companies', index: 1 } },
        { properties: { title: 'Accounts', index: 2 } },
        { properties: { title: 'Transactions', index: 3 } },
        { properties: { title: 'Cash Flow (Monthly)', index: 4 } },
        { properties: { title: 'Category Breakdown', index: 5 } },
      ],
    },
  });

  const spreadsheetId = response.data.spreadsheetId;
  const spreadsheetUrl = response.data.spreadsheetUrl;

  // Make the sheet accessible to anyone with the link
  const drive = getDriveClient(auth);
  await drive.permissions.create({
    fileId: spreadsheetId,
    requestBody: {
      role: 'writer',
      type: 'anyone',
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}

// Write all dashboard data to the spreadsheet
async function backupToSheet(spreadsheetId) {
  const auth = getAuthClient();
  const sheets = getSheetsClient(auth);
  const store = getStore();
  const now = new Date().toISOString();

  // ---- 1. Dashboard Summary ----
  const totalIncome = store.transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpenses = store.transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const summaryData = [
    ['NF6 Family Office - Financial Dashboard Backup'],
    ['Generated', now],
    [''],
    ['Key Metrics', 'Value'],
    ['Total Companies', store.companies.length],
    ['Total Linked Accounts', store.linkedItems.reduce((s, i) => s + i.accounts.length, 0)],
    ['Total Transactions', store.transactions.length],
    ['Total Income', roundTwo(totalIncome)],
    ['Total Expenses', roundTwo(totalExpenses)],
    ['Net Cash Flow', roundTwo(totalIncome - totalExpenses)],
    [''],
    ['Company Summary', 'Type', 'Income', 'Expenses', 'Net', 'Transactions'],
    ...store.companies.map(c => {
      const txns = store.transactions.filter(t => t.company_id === c.id);
      const inc = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const exp = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return [c.name, c.type, roundTwo(inc), roundTwo(exp), roundTwo(inc - exp), txns.length];
    }),
  ];

  // ---- 2. Companies ----
  const companiesData = [
    ['Company Name', 'Type', 'EIN', 'Created At', 'Linked Accounts', 'Total Transactions'],
    ...store.companies.map(c => {
      const items = store.linkedItems.filter(i => i.company_id === c.id);
      const accountCount = items.reduce((s, i) => s + i.accounts.length, 0);
      const txnCount = store.transactions.filter(t => t.company_id === c.id).length;
      return [c.name, c.type, c.ein || 'N/A', c.createdAt, accountCount, txnCount];
    }),
  ];

  // ---- 3. Accounts ----
  const accountsData = [
    ['Company', 'Institution', 'Account Name', 'Type', 'Subtype', 'Mask', 'Current Balance', 'Available Balance'],
    ...store.linkedItems.flatMap(item => {
      const company = store.companies.find(c => c.id === item.company_id);
      return item.accounts.map(a => [
        company?.name || 'Unknown',
        item.institution?.name || 'Unknown',
        a.name || a.official_name || 'N/A',
        a.type || 'N/A',
        a.subtype || 'N/A',
        a.mask || 'N/A',
        a.balances?.current ?? 'N/A',
        a.balances?.available ?? 'N/A',
      ]);
    }),
  ];

  // ---- 4. Transactions (all) ----
  const transactionsData = [
    ['Date', 'Description', 'Merchant', 'Company', 'Account', 'Institution', 'Category', 'Detailed Category', 'Amount', 'Type', 'Channel', 'Pending', 'Currency'],
    ...store.transactions
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(t => [
        t.date,
        t.name || '',
        t.merchant_name || '',
        t.company_name || '',
        t.account_name || '',
        t.institution_name || '',
        t.category || '',
        t.category_detailed || '',
        t.amount,
        t.type || '',
        t.payment_channel || '',
        t.pending ? 'Yes' : 'No',
        t.iso_currency_code || 'USD',
      ]),
  ];

  // ---- 5. Monthly Cash Flow ----
  const monthlyMap = {};
  store.transactions.forEach(t => {
    const monthKey = t.date.slice(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { income: 0, expenses: 0, count: 0 };
    if (t.amount < 0) {
      monthlyMap[monthKey].income += Math.abs(t.amount);
    } else {
      monthlyMap[monthKey].expenses += t.amount;
    }
    monthlyMap[monthKey].count++;
  });

  const cashFlowData = [
    ['Month', 'Income', 'Expenses', 'Net', 'Transactions'],
    ...Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => [
        month,
        roundTwo(d.income),
        roundTwo(d.expenses),
        roundTwo(d.income - d.expenses),
        d.count,
      ]),
  ];

  // ---- 6. Category Breakdown ----
  const categoryMap = {};
  store.transactions.forEach(t => {
    const cat = t.category || 'Other';
    if (!categoryMap[cat]) categoryMap[cat] = { income: 0, expenses: 0, count: 0 };
    if (t.amount < 0) {
      categoryMap[cat].income += Math.abs(t.amount);
    } else {
      categoryMap[cat].expenses += t.amount;
    }
    categoryMap[cat].count++;
  });

  const categoryData = [
    ['Category', 'Income', 'Expenses', 'Net', 'Transactions'],
    ...Object.entries(categoryMap)
      .sort(([, a], [, b]) => b.expenses - a.expenses)
      .map(([cat, d]) => [
        cat,
        roundTwo(d.income),
        roundTwo(d.expenses),
        roundTwo(d.income - d.expenses),
        d.count,
      ]),
  ];

  // ---- Write all sheets ----
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: 'Dashboard Summary!A1', values: summaryData },
        { range: 'Companies!A1', values: companiesData },
        { range: 'Accounts!A1', values: accountsData },
        { range: 'Transactions!A1', values: transactionsData },
        { range: 'Cash Flow (Monthly)!A1', values: cashFlowData },
        { range: 'Category Breakdown!A1', values: categoryData },
      ],
    },
  });

  // ---- Format headers (bold first row on each sheet) ----
  const sheetList = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' });
  const formatRequests = sheetList.data.sheets.map(s => ({
    repeatCell: {
      range: {
        sheetId: s.properties.sheetId,
        startRowIndex: 0,
        endRowIndex: 1,
      },
      cell: {
        userEnteredFormat: {
          textFormat: { bold: true },
          backgroundColor: { red: 0.15, green: 0.15, blue: 0.15 },
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        },
      },
      fields: 'userEnteredFormat(textFormat,backgroundColor)',
    },
  }));

  // Auto-resize columns
  const resizeRequests = sheetList.data.sheets.map(s => ({
    autoResizeDimensions: {
      dimensions: {
        sheetId: s.properties.sheetId,
        dimension: 'COLUMNS',
        startIndex: 0,
        endIndex: 15,
      },
    },
  }));

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [...formatRequests, ...resizeRequests] },
  });

  return {
    spreadsheetId,
    sheetsUpdated: 6,
    totalTransactions: store.transactions.length,
    totalCompanies: store.companies.length,
    backedUpAt: now,
  };
}

// Backup to an existing spreadsheet (clears and rewrites all data)
async function backupToExistingSheet(spreadsheetId) {
  const auth = getAuthClient();
  const sheets = getSheetsClient(auth);

  // Clear all sheets first
  const sheetNames = [
    'Dashboard Summary', 'Companies', 'Accounts',
    'Transactions', 'Cash Flow (Monthly)', 'Category Breakdown',
  ];
  for (const name of sheetNames) {
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${name}!A:Z`,
      });
    } catch (e) {
      // Sheet might not exist, that's OK
    }
  }

  return backupToSheet(spreadsheetId);
}

function roundTwo(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { createSpreadsheet, backupToSheet, backupToExistingSheet };
