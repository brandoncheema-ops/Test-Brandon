import React, { useState, useEffect } from 'react';
import { FiSearch, FiDownload, FiFilter } from 'react-icons/fi';
import api from '../api';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [filters, setFilters] = useState({
    search: '',
    company_id: '',
    type: '',
    start_date: '',
    end_date: '',
    category: '',
  });

  useEffect(() => {
    api.get('/companies').then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 50 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.get('/transactions', { params })
      .then(r => {
        setTransactions(r.data.transactions);
        setTotal(r.data.total);
        setTotalPages(r.data.totalPages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const exportCSV = () => {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    params.limit = 10000;
    api.get('/transactions', { params }).then(r => {
      const rows = r.data.transactions;
      const csv = [
        ['Date', 'Description', 'Merchant', 'Company', 'Account', 'Category', 'Amount', 'Type', 'Channel'].join(','),
        ...rows.map(t => [
          t.date,
          `"${(t.name || '').replace(/"/g, '""')}"`,
          `"${(t.merchant_name || '').replace(/"/g, '""')}"`,
          `"${t.company_name}"`,
          `"${t.account_name}"`,
          `"${t.category}"`,
          t.amount,
          t.type,
          t.payment_channel,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Transactions</h2>
          <p>{total.toLocaleString()} total transactions across all companies</p>
        </div>
        <button className="btn btn-outline" onClick={exportCSV}>
          <FiDownload /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filter-bar">
          <input
            className="search-input"
            type="text"
            placeholder="Search transactions..."
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
          />
          <select value={filters.company_id} onChange={e => handleFilterChange('company_id', e.target.value)}>
            <option value="">All Companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.type} onChange={e => handleFilterChange('type', e.target.value)}>
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <input
            type="date"
            value={filters.start_date}
            onChange={e => handleFilterChange('start_date', e.target.value)}
            placeholder="Start date"
          />
          <input
            type="date"
            value={filters.end_date}
            onChange={e => handleFilterChange('end_date', e.target.value)}
            placeholder="End date"
          />
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <h3>No transactions found</h3>
            <p>Try adjusting your filters or link a bank account to import transactions.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Company</th>
                    <th>Account</th>
                    <th>Category</th>
                    <th>Channel</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{t.date}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.merchant_name || t.name}</div>
                        {t.merchant_name && t.name !== t.merchant_name && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.name}</div>
                        )}
                      </td>
                      <td><span className="badge badge-transfer">{t.company_name}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.account_name}</td>
                      <td><span style={{ fontSize: 12 }}>{t.category}</span></td>
                      <td><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.payment_channel}</span></td>
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
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
