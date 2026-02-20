// Generates realistic demo data to test the dashboard without Plaid API access
const { v4: uuidv4 } = require('uuid');

const merchants = {
  income: [
    { name: 'Client Payment - Acme Corp', category: 'INCOME', channel: 'online' },
    { name: 'Consulting Revenue', category: 'INCOME', channel: 'online' },
    { name: 'Rental Income - 123 Main St', category: 'INCOME', channel: 'online' },
    { name: 'Dividend Payment - Vanguard', category: 'INCOME', channel: 'online' },
    { name: 'Client Payment - TechStart Inc', category: 'INCOME', channel: 'online' },
    { name: 'Revenue Share - Partner Co', category: 'INCOME', channel: 'online' },
    { name: 'Interest Income', category: 'INCOME', channel: 'online' },
    { name: 'Service Fee Collection', category: 'INCOME', channel: 'online' },
  ],
  expense: [
    { name: 'Amazon Web Services', merchant: 'AWS', category: 'SOFTWARE_AND_TECHNOLOGY', channel: 'online' },
    { name: 'Stripe Processing Fees', merchant: 'Stripe', category: 'BANK_FEES', channel: 'online' },
    { name: 'Office Lease Payment', merchant: 'WeWork', category: 'RENT_AND_UTILITIES', channel: 'online' },
    { name: 'Payroll - ADP', merchant: 'ADP', category: 'PAYROLL', channel: 'online' },
    { name: 'Health Insurance Premium', merchant: 'Blue Cross', category: 'INSURANCE', channel: 'online' },
    { name: 'Google Workspace', merchant: 'Google', category: 'SOFTWARE_AND_TECHNOLOGY', channel: 'online' },
    { name: 'Uber Eats', merchant: 'Uber Eats', category: 'FOOD_AND_DRINK', channel: 'in store' },
    { name: 'Delta Airlines', merchant: 'Delta', category: 'TRAVEL', channel: 'online' },
    { name: 'Hilton Hotels', merchant: 'Hilton', category: 'TRAVEL', channel: 'online' },
    { name: 'Office Depot', merchant: 'Office Depot', category: 'GENERAL_MERCHANDISE', channel: 'in store' },
    { name: 'Comcast Business Internet', merchant: 'Comcast', category: 'RENT_AND_UTILITIES', channel: 'online' },
    { name: 'FedEx Shipping', merchant: 'FedEx', category: 'GENERAL_SERVICES', channel: 'online' },
    { name: 'QuickBooks Subscription', merchant: 'Intuit', category: 'SOFTWARE_AND_TECHNOLOGY', channel: 'online' },
    { name: 'LinkedIn Advertising', merchant: 'LinkedIn', category: 'MARKETING', channel: 'online' },
    { name: 'State Tax Payment', merchant: 'State of CA', category: 'TAX', channel: 'online' },
    { name: 'Legal Services - Smith & Associates', merchant: 'Smith Law', category: 'PROFESSIONAL_SERVICES', channel: 'online' },
    { name: 'Costco Wholesale', merchant: 'Costco', category: 'GENERAL_MERCHANDISE', channel: 'in store' },
    { name: 'Shell Gas Station', merchant: 'Shell', category: 'TRANSPORTATION', channel: 'in store' },
    { name: 'AT&T Wireless', merchant: 'AT&T', category: 'RENT_AND_UTILITIES', channel: 'online' },
    { name: 'Zoom Video Communications', merchant: 'Zoom', category: 'SOFTWARE_AND_TECHNOLOGY', channel: 'online' },
  ],
};

const companies = [
  { name: 'NF6 Holdings LLC', type: 'LLC', ein: '82-1234567' },
  { name: 'NF6 Properties Inc', type: 'S-Corp', ein: '83-7654321' },
  { name: 'NF6 Ventures LP', type: 'Partnership', ein: '84-1112233' },
  { name: 'NF6 Consulting Group', type: 'LLC', ein: '85-4455667' },
];

const banks = [
  { name: 'Chase Business', accounts: [
    { name: 'Business Checking', type: 'depository', subtype: 'checking', balance: 145832.50 },
    { name: 'Business Savings', type: 'depository', subtype: 'savings', balance: 523000.00 },
  ]},
  { name: 'Bank of America', accounts: [
    { name: 'Operating Account', type: 'depository', subtype: 'checking', balance: 87421.33 },
    { name: 'Business Credit Card', type: 'credit', subtype: 'credit card', balance: 12450.00 },
  ]},
  { name: 'Wells Fargo', accounts: [
    { name: 'Primary Checking', type: 'depository', subtype: 'checking', balance: 234100.75 },
  ]},
];

function randomBetween(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(monthsBack) {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - monthsBack);
  const diff = now.getTime() - start.getTime();
  return new Date(start.getTime() + Math.random() * diff).toISOString().split('T')[0];
}

function generateDemoData() {
  const companyRecords = companies.map(c => ({
    id: uuidv4(),
    name: c.name,
    type: c.type,
    ein: c.ein,
    createdAt: new Date().toISOString(),
  }));

  const linkedItems = [];
  const allTransactions = [];

  companyRecords.forEach((company, ci) => {
    // Assign 1-2 banks per company
    const bankCount = ci < 2 ? 2 : 1;
    for (let bi = 0; bi < bankCount; bi++) {
      const bank = banks[(ci + bi) % banks.length];
      const accounts = bank.accounts.map(a => ({
        account_id: uuidv4(),
        name: a.name,
        official_name: `${bank.name} ${a.name}`,
        type: a.type,
        subtype: a.subtype,
        mask: String(Math.floor(1000 + Math.random() * 9000)),
        balances: {
          current: a.balance + randomBetween(-10000, 10000),
          available: a.balance + randomBetween(-5000, 15000),
          limit: a.type === 'credit' ? 50000 : null,
        },
      }));

      const item = {
        id: uuidv4(),
        item_id: `item_${uuidv4().slice(0, 8)}`,
        access_token: `access-sandbox-${uuidv4()}`,
        company_id: company.id,
        institution: { name: bank.name, institution_id: `ins_${ci}${bi}` },
        accounts,
        linkedAt: new Date().toISOString(),
      };
      linkedItems.push(item);

      // Generate transactions for each account
      accounts.forEach(account => {
        // 18 months of transactions, ~8-15 per month
        for (let month = 0; month < 18; month++) {
          const txnCount = Math.floor(8 + Math.random() * 8);
          for (let t = 0; t < txnCount; t++) {
            const isIncome = Math.random() < 0.3; // 30% income, 70% expense
            const template = isIncome
              ? merchants.income[Math.floor(Math.random() * merchants.income.length)]
              : merchants.expense[Math.floor(Math.random() * merchants.expense.length)];

            const amount = isIncome
              ? -randomBetween(500, 25000)  // Negative = income in Plaid
              : randomBetween(15, 8000);     // Positive = expense in Plaid

            // Generate date within specific month
            const now = new Date();
            const txnDate = new Date(now.getFullYear(), now.getMonth() - month, Math.floor(1 + Math.random() * 27));
            if (txnDate > now) continue;

            allTransactions.push({
              id: uuidv4(),
              company_id: company.id,
              company_name: company.name,
              account_id: account.account_id,
              account_name: account.name,
              institution_name: bank.name,
              date: txnDate.toISOString().split('T')[0],
              name: template.name,
              merchant_name: template.merchant || template.name.split(' - ')[0],
              amount,
              category: template.category,
              category_detailed: `${template.category} > ${template.name}`,
              pending: month === 0 && Math.random() < 0.1,
              payment_channel: template.channel,
              iso_currency_code: 'USD',
              type: amount > 0 ? 'expense' : 'income',
            });
          }
        }
      });
    }
  });

  return {
    companies: companyRecords,
    linkedItems,
    transactions: allTransactions,
  };
}

module.exports = { generateDemoData };
