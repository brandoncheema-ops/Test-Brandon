// In-memory data store with JSON file persistence
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

const defaultData = {
  companies: [],
  // Map of item_id -> { access_token, institution, accounts, company_id }
  linkedItems: [],
  // Cached transactions
  transactions: [],
  // Categories for chart of accounts
  categories: [
    { id: 'revenue', name: 'Revenue', type: 'income' },
    { id: 'cogs', name: 'Cost of Goods Sold', type: 'expense' },
    { id: 'payroll', name: 'Payroll & Benefits', type: 'expense' },
    { id: 'rent', name: 'Rent & Occupancy', type: 'expense' },
    { id: 'utilities', name: 'Utilities', type: 'expense' },
    { id: 'insurance', name: 'Insurance', type: 'expense' },
    { id: 'marketing', name: 'Marketing & Advertising', type: 'expense' },
    { id: 'professional', name: 'Professional Services', type: 'expense' },
    { id: 'travel', name: 'Travel & Entertainment', type: 'expense' },
    { id: 'office', name: 'Office Supplies', type: 'expense' },
    { id: 'software', name: 'Software & Technology', type: 'expense' },
    { id: 'taxes', name: 'Taxes & Licenses', type: 'expense' },
    { id: 'depreciation', name: 'Depreciation & Amortization', type: 'expense' },
    { id: 'interest', name: 'Interest & Bank Fees', type: 'expense' },
    { id: 'other_income', name: 'Other Income', type: 'income' },
    { id: 'other_expense', name: 'Other Expense', type: 'expense' },
    { id: 'transfer', name: 'Transfer', type: 'transfer' },
  ],
};

let store = { ...defaultData };

// Load from file if exists
function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      store = { ...defaultData, ...parsed };
    }
  } catch (e) {
    console.log('No existing data file, starting fresh');
  }
}

function save() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('Error saving data:', e.message);
  }
}

function getStore() {
  return store;
}

function updateStore(key, value) {
  store[key] = value;
  save();
}

load();

module.exports = { getStore, updateStore, save };
