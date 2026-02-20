import React, { useState, useEffect } from 'react';
import { FiDownload, FiShield, FiAlertTriangle } from 'react-icons/fi';
import api from '../api';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Audit() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/audit')
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data) return;
    const csv = [
      ['Date', 'Description', 'Merchant', 'Company', 'Account', 'Institution', 'Category', 'Detailed Category', 'Amount', 'Type', 'Channel', 'Pending', 'Currency'].join(','),
      ...data.transactions.map(t => [
        t.date,
        `"${(t.name || '').replace(/"/g, '""')}"`,
        `"${(t.merchant_name || '').replace(/"/g, '""')}"`,
        `"${t.company_name}"`,
        `"${t.account_name}"`,
        `"${t.institution_name}"`,
        `"${t.category}"`,
        `"${t.category_detailed}"`,
        t.amount,
        t.type,
        t.payment_channel,
        t.pending,
        t.iso_currency_code,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="loading">Loading audit data...</div>;
  if (!data) return <div className="empty-state"><h3>No data</h3></div>;

  const { transactions, summary, totalRecords, exportDate } = data;

  // Flag large transactions (over $5000) for audit attention
  const flaggedTransactions = transactions.filter(t => Math.abs(t.amount) > 5000);

  return (
    <div>
      <div className="section-header">
        <div>
          <h2><FiShield style={{ verticalAlign: 'middle', marginRight: 8 }} />Audit Trail</h2>
          <p>{totalRecords.toLocaleString()} transactions | Report generated {new Date(exportDate).toLocaleString()}</p>
        </div>
        <div className="export-actions">
          <button className="btn btn-outline" onClick={exportCSV}>
            <FiDownload /> Export CSV
          </button>
          <button className="btn btn-outline" onClick={exportJSON}>
            <FiDownload /> Export JSON
          </button>
        </div>
      </div>

      {/* Company Summary */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">Company Audit Summary</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th style={{ textAlign: 'right' }}>Total Income</th>
                <th style={{ textAlign: 'right' }}>Total Expenses</th>
                <th style={{ textAlign: 'right' }}>Net</th>
                <th style={{ textAlign: 'right' }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(summary).map(([name, s]) => (
                <tr key={name}>
                  <td><strong>{name}</strong></td>
                  <td style={{ textAlign: 'right' }} className="amount-positive">{fmt(s.income)}</td>
                  <td style={{ textAlign: 'right' }} className="amount-negative">{fmt(s.expenses)}</td>
                  <td style={{ textAlign: 'right' }} className={s.income - s.expenses >= 0 ? 'amount-positive' : 'amount-negative'}>
                    {fmt(s.income - s.expenses)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{s.count}</td>
                </tr>
              ))}
              {Object.keys(summary).length > 1 && (
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                  <td>TOTAL</td>
                  <td style={{ textAlign: 'right' }} className="amount-positive">
                    {fmt(Object.values(summary).reduce((s, v) => s + v.income, 0))}
                  </td>
                  <td style={{ textAlign: 'right' }} className="amount-negative">
                    {fmt(Object.values(summary).reduce((s, v) => s + v.expenses, 0))}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {fmt(Object.values(summary).reduce((s, v) => s + v.income - v.expenses, 0))}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {Object.values(summary).reduce((s, v) => s + v.count, 0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flagged Transactions */}
      {flaggedTransactions.length > 0 && (
        <div className="card" style={{ marginBottom: 24, borderColor: 'var(--yellow)' }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ color: 'var(--yellow)' }}>
                <FiAlertTriangle style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Flagged Transactions ({flaggedTransactions.length})
              </div>
              <div className="card-subtitle">Transactions over $5,000 flagged for review</div>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Company</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {flaggedTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.merchant_name || t.name}</td>
                    <td><span className="badge badge-transfer">{t.company_name}</span></td>
                    <td style={{ fontSize: 12 }}>{t.account_name}</td>
                    <td>{t.category}</td>
                    <td style={{ textAlign: 'right' }} className={t.amount > 0 ? 'amount-negative' : 'amount-positive'}>
                      {t.amount > 0 ? '-' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Transaction Log */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Complete Transaction Log</div>
            <div className="card-subtitle">All {totalRecords.toLocaleString()} transactions across all entities</div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Company</th>
                <th>Account</th>
                <th>Institution</th>
                <th>Category</th>
                <th>Channel</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No transactions to audit. Link bank accounts to pull transaction data.
                  </td>
                </tr>
              ) : (
                transactions.slice(0, 200).map(t => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{t.merchant_name || t.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.category_detailed}</div>
                    </td>
                    <td><span className="badge badge-transfer">{t.company_name}</span></td>
                    <td style={{ fontSize: 12 }}>{t.account_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.institution_name}</td>
                    <td><span style={{ fontSize: 12 }}>{t.category}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.payment_channel}</td>
                    <td style={{ textAlign: 'right' }} className={t.amount > 0 ? 'amount-negative' : 'amount-positive'}>
                      {t.amount > 0 ? '-' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                    <td>
                      {t.pending
                        ? <span className="badge badge-pending">Pending</span>
                        : <span className="badge badge-income">Cleared</span>
                      }
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {transactions.length > 200 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Showing 200 of {transactions.length} transactions. Export to CSV/JSON for full data.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
