import React, { useState, useEffect } from 'react';
import { FiDollarSign } from 'react-icons/fi';
import api from '../api';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accounts')
      .then(r => {
        setAccounts(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading accounts...</div>;

  // Group by company
  const grouped = {};
  accounts.forEach(a => {
    if (!grouped[a.company_name]) grouped[a.company_name] = [];
    grouped[a.company_name].push(a);
  });

  const totalBalance = accounts.reduce((sum, a) => sum + (a.balances?.current || 0), 0);

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Accounts</h2>
          <p>{accounts.length} accounts across {Object.keys(grouped).length} companies</p>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Balance (All Accounts)</div>
          <div className="kpi-value positive">{fmt(totalBalance)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Checking Accounts</div>
          <div className="kpi-value neutral">
            {fmt(accounts.filter(a => a.subtype === 'checking').reduce((s, a) => s + (a.balances?.current || 0), 0))}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Savings Accounts</div>
          <div className="kpi-value neutral">
            {fmt(accounts.filter(a => a.subtype === 'savings').reduce((s, a) => s + (a.balances?.current || 0), 0))}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Credit Cards</div>
          <div className="kpi-value negative">
            {fmt(accounts.filter(a => a.type === 'credit').reduce((s, a) => s + (a.balances?.current || 0), 0))}
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No accounts linked</h3>
            <p>Go to Companies and link bank accounts via Plaid to see account balances.</p>
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([companyName, companyAccounts]) => (
          <div key={companyName} className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <div>
                <div className="card-title">{companyName}</div>
                <div className="card-subtitle">
                  {companyAccounts.length} account{companyAccounts.length !== 1 ? 's' : ''} |
                  Total: {fmt(companyAccounts.reduce((s, a) => s + (a.balances?.current || 0), 0))}
                </div>
              </div>
            </div>
            <div className="accounts-list">
              {companyAccounts.map(a => (
                <div key={a.account_id} className="account-card">
                  <div className="account-info">
                    <h4>{a.name}</h4>
                    <p>
                      {a.institution_name} | {a.type} - {a.subtype}
                      {a.mask && ` | ****${a.mask}`}
                    </p>
                  </div>
                  <div className="account-balance">
                    <div className="balance-amount">{fmt(a.balances?.current)}</div>
                    <div className="balance-label">
                      {a.balances?.available != null && `Available: ${fmt(a.balances.available)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
