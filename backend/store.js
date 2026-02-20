/**
 * MN Family Office - In-Memory Data Store
 * Contains all entity, institution, and account data from real financial screenshots.
 * All data resets on server restart.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nf6-dev-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

let nextId = 100;
const genId = () => String(++nextId);

// ============================================================
// USERS (auth)
// ============================================================
const users = [];

const createUser = async ({ name, email, password, role = 'owner' }) => {
  const hashed = await bcrypt.hash(password, 12);
  const user = { _id: genId(), name, email: email.toLowerCase(), password: hashed, role, createdAt: new Date() };
  users.push(user);
  return user;
};

const findUserByEmail = (email) => users.find(u => u.email === email.toLowerCase());
const findUserById = (id) => users.find(u => u._id === id);
const comparePassword = async (plain, hashed) => bcrypt.compare(plain, hashed);
const generateToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });
const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// ============================================================
// EXCHANGE RATES (as of Feb 19, 2026)
// ============================================================
const exchangeRates = {
  USD: 1.0,
  EUR: 1.08,
  COP: 0.0002712  // 1 / 3688
};

const getExchangeRates = () => ({ ...exchangeRates, lastUpdated: '2026-02-19T00:00:00Z' });

const toUSD = (amount, currency) => {
  const rate = exchangeRates[currency] || 1;
  return amount * rate;
};

// ============================================================
// ENTITIES (~20 family office entities)
// ============================================================
const entities = [
  { _id: 'e1', name: 'Michael Nguyen', shortName: 'MN Personal', type: 'Personal', jurisdiction: 'US - PR', description: 'Personal accounts of Michael Nguyen' },
  { _id: 'e2', name: 'MN Family Trust', shortName: 'MN Family Trust', type: 'Trust', jurisdiction: 'US', description: 'MN Family Trust' },
  { _id: 'e3', name: 'The 2019 MN Family Revocable Trust', shortName: '2019 MN Trust', type: 'Trust', jurisdiction: 'US', description: 'The 2019 MN Family Revocable Trust' },
  { _id: 'e4', name: 'YM PR Investment Group LLC', shortName: 'YM PR Invest', type: 'LLC', jurisdiction: 'US - PR', description: 'Puerto Rico investment group' },
  { _id: 'e5', name: 'MBJ DR INC', shortName: 'MBJ DR', type: 'Inc', jurisdiction: 'US', description: 'MBJ DR INC' },
  { _id: 'e6', name: 'NF USA CA LLC', shortName: 'NF USA CA', type: 'LLC', jurisdiction: 'US - CA', description: 'California entity' },
  { _id: 'e7', name: 'NF USA TX LLC', shortName: 'NF USA TX', type: 'LLC', jurisdiction: 'US - TX', description: 'Texas entity' },
  { _id: 'e8', name: 'NF6 Ventures LLC', shortName: 'NF6 Ventures', type: 'LLC', jurisdiction: 'US', description: 'NF6 Ventures LLC' },
  { _id: 'e9', name: 'Blue Panda Family Limited Partnership', shortName: 'Blue Panda FLP', type: 'LP', jurisdiction: 'US', description: 'Blue Panda Family Limited Partnership' },
  { _id: 'e10', name: 'NGM Woodland Park ASC LLC', shortName: 'NGM Woodland', type: 'LLC', jurisdiction: 'US', description: 'Woodland Park entity' },
  { _id: 'e11', name: 'NF6 Joint MGMT LLC', shortName: 'NF6 Joint MGMT', type: 'LLC', jurisdiction: 'US', description: 'Joint management entity' },
  { _id: 'e12', name: 'NF6 Tiger Capital LLC', shortName: 'NF6 Tiger Cap', type: 'LLC', jurisdiction: 'US', description: 'Tiger Capital investment entity' },
  { _id: 'e13', name: 'TLMND LLC', shortName: 'TLMND', type: 'LLC', jurisdiction: 'US', description: 'TLMND LLC' },
  { _id: 'e14', name: 'NF6 Family Holding LP', shortName: 'NF6 Family Hold', type: 'LP', jurisdiction: 'US', description: 'NF6 Family Holding LP' },
  { _id: 'e15', name: 'NF6 Capital LLC', shortName: 'NF6 Capital', type: 'LLC', jurisdiction: 'US', description: 'NF6 Capital LLC' },
  { _id: 'e16', name: 'BPMGMT LLC', shortName: 'BPMGMT', type: 'LLC', jurisdiction: 'US', description: 'BPMGMT LLC' },
  { _id: 'e17', name: 'NF6 Spain Holdings SL', shortName: 'NF6 Spain', type: 'SL', jurisdiction: 'Spain', description: 'Spanish holding company' },
  { _id: 'e18', name: 'NF Europe Holdings 2022 SL', shortName: 'NF Europe', type: 'SL', jurisdiction: 'Spain', description: 'European holding company' },
  { _id: 'e19', name: 'Paris Thacko', shortName: 'Paris Thacko', type: 'Company', jurisdiction: 'Spain', description: 'Paris Thacko' },
  { _id: 'e20', name: 'MN Dorado Property', shortName: 'MN Dorado PH', type: 'Personal', jurisdiction: 'US - PR', description: 'Dorado Beach property holdings' },
];

// ============================================================
// INSTITUTIONS
// ============================================================
const institutions = [
  { _id: 'i1', name: 'FirstBank Puerto Rico', shortName: 'FirstBank PR', type: 'Bank', country: 'US - PR', color: '#1a5276', logo: 'FB' },
  { _id: 'i2', name: 'Bank of America', shortName: 'BoFA', type: 'Bank', country: 'US', color: '#c0392b', logo: 'BA' },
  { _id: 'i3', name: 'Chase', shortName: 'Chase', type: 'Bank', country: 'US', color: '#2c3e50', logo: 'CH' },
  { _id: 'i4', name: 'J.P. Morgan', shortName: 'JPM', type: 'Investment Bank', country: 'US', color: '#1a3c6e', logo: 'JP' },
  { _id: 'i5', name: 'Charles Schwab', shortName: 'Schwab', type: 'Brokerage', country: 'US', color: '#00a0df', logo: 'CS' },
  { _id: 'i6', name: 'Santander (Spain)', shortName: 'Santander', type: 'Bank', country: 'Spain', color: '#ec0000', logo: 'SN' },
  { _id: 'i7', name: 'Bancolombia', shortName: 'Bancolombia', type: 'Bank', country: 'Colombia', color: '#003DA5', logo: 'BC' },
  { _id: 'i8', name: 'Banco de Occidente', shortName: 'Occidente', type: 'Bank', country: 'Colombia', color: '#005ca9', logo: 'BO' },
  { _id: 'i9', name: 'QuickBooks Online', shortName: 'QBO', type: 'Accounting', country: 'US', color: '#2ca01c', logo: 'QB' },
];

// ============================================================
// ACCOUNTS (all real data from screenshots)
// ============================================================
const accounts = [
  // --- FirstBank PR ---
  { _id: 'a1', entity: 'e1', institution: 'i1', name: 'Michael Nguyen PMA', accountNumber: '030126916', accountType: 'Checking', balance: 22.27, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a2', entity: 'e4', institution: 'i1', name: 'YM PR Investment Group LLC', accountNumber: '030138337', accountType: 'Checking', balance: 227434.12, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a3', entity: 'e4', institution: 'i1', name: 'YM PR Investment Group LLC', accountNumber: '030219175', accountType: 'Savings', balance: 47960.37, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a4', entity: 'e2', institution: 'i1', name: 'MN Family Trust', accountNumber: '030228875', accountType: 'Checking', balance: 2322.44, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a5', entity: 'e3', institution: 'i1', name: '2019 MN Family Revocable Trust', accountNumber: '030267013', accountType: 'Checking', balance: 50000.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a6', entity: 'e1', institution: 'i1', name: 'Michael Nguyen PH', accountNumber: '030290252', accountType: 'Checking', balance: 1.59, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Bank of America ---
  { _id: 'a7', entity: 'e1', institution: 'i2', name: 'BoFA Personal Banking', accountNumber: '****8651', accountType: 'Checking', balance: 5010.86, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Chase ---
  { _id: 'a8', entity: 'e1', institution: 'i3', name: 'MN Personal Checking', accountNumber: '****0451', accountType: 'Checking', balance: 5000.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a9', entity: 'e20', institution: 'i3', name: 'MN - Dorado PH', accountNumber: '****6179', accountType: 'Checking', balance: 22347.06, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a10', entity: 'e1', institution: 'i3', name: 'MN Personal Savings', accountNumber: '****0451', accountType: 'Savings', balance: 4199.73, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a11', entity: 'e1', institution: 'i3', name: 'Mortgage Loan', accountNumber: '****3064', accountType: 'Mortgage', balance: 2494214.24, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: true },

  // --- J.P. Morgan ---
  { _id: 'a12', entity: 'e12', institution: 'i4', name: 'NF6 Tiger Capital LLC', accountNumber: '****2502', accountType: 'Investment', balance: 10.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a13', entity: 'e12', institution: 'i4', name: 'NF6 Tiger Capital LLC', accountNumber: '****4974', accountType: 'Investment', balance: 0.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Charles Schwab (Authorized Accounts) ---
  { _id: 'a14', entity: 'e15', institution: 'i5', name: 'NF6 Capital', accountNumber: 'Z25411126', accountType: 'Brokerage', balance: 1565.04, currency: 'USD', dayChange: -4.42, dayChangePercent: -0.28, isLiability: false },
  { _id: 'a15', entity: 'e1', institution: 'i5', name: 'MN Personal', accountNumber: 'Z27319007', accountType: 'Brokerage', balance: 1809397.56, currency: 'USD', dayChange: 21326.35, dayChangePercent: 1.19, isLiability: false },
  { _id: 'a16', entity: 'e13', institution: 'i5', name: 'TLMND', accountNumber: 'Z27516454', accountType: 'Brokerage', balance: 179907.47, currency: 'USD', dayChange: 0.64, dayChangePercent: 0.00, isLiability: false },
  { _id: 'a17', entity: 'e12', institution: 'i5', name: 'NF6 Tiger Capital (VOO)', accountNumber: 'Z29628205', accountType: 'Brokerage', balance: 2130.42, currency: 'USD', dayChange: -0.67, dayChangePercent: -0.03, isLiability: false },
  { _id: 'a18', entity: 'e12', institution: 'i5', name: 'NF6 Tiger Capital (Dividends)', accountNumber: 'Z40362104', accountType: 'Brokerage', balance: 3580.71, currency: 'USD', dayChange: -8.66, dayChangePercent: -0.24, isLiability: false },

  // --- Charles Schwab (Investment Accounts) ---
  { _id: 'a19', entity: 'e1', institution: 'i5', name: 'MN Personal Investment', accountNumber: '****748', accountType: 'Investment', balance: 10996.90, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a20', entity: 'e14', institution: 'i5', name: 'NF6 Family Holding', accountNumber: '****316', accountType: 'Brokerage', balance: 324.79, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a21', entity: 'e12', institution: 'i5', name: 'NF6 Tiger Capital', accountNumber: '****259', accountType: 'Brokerage', balance: 1378.59, currency: 'USD', dayChange: -2.56, dayChangePercent: -0.19, isLiability: false },

  // --- Charles Schwab (Trust Accounts) ---
  { _id: 'a22', entity: 'e3', institution: 'i5', name: '2019 MN Family Trust', accountNumber: '****196', accountType: 'Trust', balance: 0, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a23', entity: 'e2', institution: 'i5', name: 'MN Family Trust', accountNumber: '****805', accountType: 'Trust', balance: 0, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Santander (Spain) ---
  { _id: 'a24', entity: 'e17', institution: 'i6', name: 'NF6 Spain Holdings SL', accountNumber: 'ES09****8120', accountType: 'Checking', balance: 1248.48, currency: 'EUR', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a25', entity: 'e18', institution: 'i6', name: 'NF Europe Holdings 2022 SL', accountNumber: 'ES44****8138', accountType: 'Checking', balance: 5730.70, currency: 'EUR', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a26', entity: 'e19', institution: 'i6', name: 'Paris Thacko', accountNumber: 'ES66****0523', accountType: 'Checking', balance: 2731.81, currency: 'EUR', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a27', entity: 'e18', institution: 'i6', name: 'NF Europe Holdings 2022 SL (USD)', accountNumber: 'ES49****1830', accountType: 'Checking', balance: 2.07, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Bancolombia ---
  { _id: 'a28', entity: 'e1', institution: 'i7', name: 'Bancolombia Savings', accountNumber: '029-000177-34', accountType: 'Savings', balance: 49449012.26, currency: 'COP', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a29', entity: 'e1', institution: 'i7', name: 'Bancolombia Additional', accountNumber: '029-****-XX', accountType: 'Savings', balance: 150000000, currency: 'COP', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- Banco de Occidente ---
  { _id: 'a30', entity: 'e1', institution: 'i8', name: 'Occidente Holdings', accountNumber: 'OCC-****', accountType: 'Savings', balance: 127420185.74, currency: 'COP', dayChange: 0, dayChangePercent: 0, isLiability: false },

  // --- QBO-Tracked Bank Accounts ---
  { _id: 'a31', entity: 'e5', institution: 'i9', name: 'MBJ DR INC - Operating', accountNumber: 'QBO-MBJ', accountType: 'Checking', balance: 9775.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a32', entity: 'e6', institution: 'i9', name: 'NF USA CA LLC - Operating', accountNumber: 'QBO-NFCA', accountType: 'Checking', balance: 200.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a33', entity: 'e7', institution: 'i9', name: 'NF USA TX LLC - Operating', accountNumber: 'QBO-NFTX', accountType: 'Checking', balance: 30535.86, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a34', entity: 'e8', institution: 'i9', name: 'NF6 Ventures LLC - Operating', accountNumber: 'QBO-VENT', accountType: 'Checking', balance: 301.64, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a35', entity: 'e9', institution: 'i9', name: 'Blue Panda FLP - Operating', accountNumber: 'QBO-BPFLP', accountType: 'Checking', balance: 1715.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a36', entity: 'e10', institution: 'i9', name: 'NGM Woodland Park - Operating', accountNumber: 'QBO-NGM', accountType: 'Checking', balance: 2550.55, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a37', entity: 'e11', institution: 'i9', name: 'NF6 Joint MGMT - Operating', accountNumber: 'QBO-JMGMT', accountType: 'Checking', balance: 75458.85, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a38', entity: 'e12', institution: 'i9', name: 'NF6 Tiger Capital - Operating', accountNumber: 'QBO-TIGER', accountType: 'Checking', balance: 1448.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a39', entity: 'e13', institution: 'i9', name: 'TLMND LLC - Operating', accountNumber: 'QBO-TLMND', accountType: 'Checking', balance: 67112.40, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a40', entity: 'e14', institution: 'i9', name: 'NF6 Family Holding LP - Operating', accountNumber: 'QBO-NFHOLD', accountType: 'Checking', balance: 1013.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a41', entity: 'e15', institution: 'i9', name: 'NF6 Capital LLC - Operating', accountNumber: 'QBO-NFCAP', accountType: 'Checking', balance: 1715.00, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
  { _id: 'a42', entity: 'e16', institution: 'i9', name: 'BPMGMT LLC - Operating', accountNumber: 'QBO-BPMGMT', accountType: 'Checking', balance: 2641.33, currency: 'USD', dayChange: 0, dayChangePercent: 0, isLiability: false },
];

// ============================================================
// QUERY HELPERS
// ============================================================

const getEntities = () => entities;
const getEntityById = (id) => entities.find(e => e._id === id);

const getInstitutions = () => institutions;
const getInstitutionById = (id) => institutions.find(i => i._id === id);

const getAccounts = (filter = {}) => {
  let result = [...accounts];
  if (filter.entity) result = result.filter(a => a.entity === filter.entity);
  if (filter.institution) result = result.filter(a => a.institution === filter.institution);
  if (filter.currency) result = result.filter(a => a.currency === filter.currency);
  if (filter.accountType) result = result.filter(a => a.accountType === filter.accountType);
  if (filter.isLiability !== undefined) result = result.filter(a => a.isLiability === filter.isLiability);
  return result;
};

const getAccountById = (id) => accounts.find(a => a._id === id);

// Get accounts with populated entity and institution
const populateAccount = (acct) => {
  if (!acct) return acct;
  return {
    ...acct,
    entityData: getEntityById(acct.entity),
    institutionData: getInstitutionById(acct.institution),
    balanceUSD: toUSD(acct.isLiability ? -acct.balance : acct.balance, acct.currency)
  };
};

// ============================================================
// AGGREGATION HELPERS
// ============================================================

const getEntitySummary = (entityId) => {
  const accts = accounts.filter(a => a.entity === entityId);
  let totalAssets = 0;
  let totalLiabilities = 0;
  let dayChangeTotal = 0;

  for (const a of accts) {
    const usd = toUSD(a.balance, a.currency);
    if (a.isLiability) {
      totalLiabilities += usd;
    } else {
      totalAssets += usd;
    }
    dayChangeTotal += toUSD(a.dayChange || 0, a.currency);
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    dayChange: dayChangeTotal,
    accountCount: accts.length
  };
};

const getInstitutionSummary = (instId) => {
  const accts = accounts.filter(a => a.institution === instId);
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const a of accts) {
    const usd = toUSD(a.balance, a.currency);
    if (a.isLiability) {
      totalLiabilities += usd;
    } else {
      totalAssets += usd;
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    netValue: totalAssets - totalLiabilities,
    accountCount: accts.length
  };
};

const getDashboardSummary = () => {
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalDayChange = 0;

  // By institution
  const byInstitution = {};
  // By entity type
  const byEntityType = {};
  // By currency
  const byCurrency = { USD: 0, EUR: 0, COP: 0 };

  for (const a of accounts) {
    const usd = toUSD(a.balance, a.currency);

    if (a.isLiability) {
      totalLiabilities += usd;
    } else {
      totalAssets += usd;
      // Track by currency (assets only)
      byCurrency[a.currency] = (byCurrency[a.currency] || 0) + a.balance;
    }

    totalDayChange += toUSD(a.dayChange || 0, a.currency);

    // By institution (net value)
    const inst = getInstitutionById(a.institution);
    const instName = inst ? inst.shortName : 'Unknown';
    if (!byInstitution[instName]) byInstitution[instName] = { assets: 0, liabilities: 0, color: inst?.color || '#999' };
    if (a.isLiability) {
      byInstitution[instName].liabilities += usd;
    } else {
      byInstitution[instName].assets += usd;
    }

    // By entity type
    const ent = getEntityById(a.entity);
    const entType = ent ? ent.type : 'Unknown';
    if (!byEntityType[entType]) byEntityType[entType] = { assets: 0, liabilities: 0 };
    if (a.isLiability) {
      byEntityType[entType].liabilities += usd;
    } else {
      byEntityType[entType].assets += usd;
    }
  }

  return {
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
    totalDayChange,
    entityCount: entities.length,
    institutionCount: institutions.length,
    accountCount: accounts.length,
    byInstitution,
    byEntityType,
    byCurrency,
    exchangeRates: getExchangeRates(),
    lastUpdated: '2026-02-19T16:30:00Z'
  };
};

// Get top accounts by USD value
const getTopAccounts = (limit = 10) => {
  return accounts
    .filter(a => !a.isLiability)
    .map(a => populateAccount(a))
    .sort((a, b) => Math.abs(b.balanceUSD) - Math.abs(a.balanceUSD))
    .slice(0, limit);
};

// Get all entities with their summary
const getEntitiesWithSummary = () => {
  return entities.map(e => ({
    ...e,
    ...getEntitySummary(e._id)
  })).sort((a, b) => b.netWorth - a.netWorth);
};

// Get all institutions with their summary
const getInstitutionsWithSummary = () => {
  return institutions.map(i => ({
    ...i,
    ...getInstitutionSummary(i._id)
  })).sort((a, b) => b.netValue - a.netValue);
};

module.exports = {
  // Users
  createUser, findUserByEmail, findUserById, comparePassword, generateToken, verifyToken,
  // Data
  getEntities, getEntityById, getInstitutions, getInstitutionById,
  getAccounts, getAccountById, populateAccount,
  // Aggregation
  getEntitySummary, getInstitutionSummary, getDashboardSummary,
  getTopAccounts, getEntitiesWithSummary, getInstitutionsWithSummary,
  getExchangeRates, toUSD
};
