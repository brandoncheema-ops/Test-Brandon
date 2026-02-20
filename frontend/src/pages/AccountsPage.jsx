import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiSearch, FiFilter } from 'react-icons/fi';
import api from '../utils/api';

const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const fmtCurrency = (n, currency) => {
  if (currency === 'COP') return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  if (currency === 'EUR') return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  return fmtFull(n);
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [sortField, setSortField] = useState('balanceUSD');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    api.get('/accounts')
      .then(res => setAccounts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  const currencies = ['All', ...new Set(accounts.map(a => a.currency))];
  const types = ['All', ...new Set(accounts.map(a => a.accountType))];

  let filtered = accounts.filter(a => {
    const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
                          a.accountNumber.toLowerCase().includes(search.toLowerCase()) ||
                          (a.entityData?.shortName || '').toLowerCase().includes(search.toLowerCase()) ||
                          (a.institutionData?.shortName || '').toLowerCase().includes(search.toLowerCase());
    const matchesCurrency = currencyFilter === 'All' || a.currency === currencyFilter;
    const matchesType = typeFilter === 'All' || a.accountType === typeFilter;
    return matchesSearch && matchesCurrency && matchesType;
  });

  filtered.sort((a, b) => {
    let valA, valB;
    if (sortField === 'balanceUSD') {
      valA = Math.abs(a.balanceUSD);
      valB = Math.abs(b.balanceUSD);
    } else if (sortField === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortField === 'entity') {
      valA = (a.entityData?.shortName || '').toLowerCase();
      valB = (b.entityData?.shortName || '').toLowerCase();
    } else if (sortField === 'institution') {
      valA = (a.institutionData?.shortName || '').toLowerCase();
      valB = (b.institutionData?.shortName || '').toLowerCase();
    }
    if (sortDir === 'asc') return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const totalAssetsUSD = filtered.filter(a => !a.isLiability).reduce((s, a) => s + a.balanceUSD, 0);
  const totalLiabilitiesUSD = filtered.filter(a => a.isLiability).reduce((s, a) => s + Math.abs(a.balanceUSD), 0);

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">All Accounts</h1>
        <p className="page-subtitle">{accounts.length} accounts across all entities and institutions</p>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="kpi-card">
          <div className="kpi-label">Showing</div>
          <div className="kpi-value">{filtered.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Assets (USD)</div>
          <div className="kpi-value positive" style={{ fontSize: 20 }}>{fmtFull(totalAssetsUSD)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Liabilities (USD)</div>
          <div className="kpi-value negative" style={{ fontSize: 20 }}>{fmtFull(totalLiabilitiesUSD)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net (USD)</div>
          <div className="kpi-value" style={{ fontSize: 20, color: (totalAssetsUSD - totalLiabilitiesUSD) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtFull(totalAssetsUSD - totalLiabilitiesUSD)}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search accounts, entities, institutions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 130 }} value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}>
          {currencies.map(c => <option key={c} value={c}>{c === 'All' ? 'All Currencies' : c}</option>)}
        </select>
        <select className="form-select" style={{ width: 150 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {types.map(t => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>Account{sortIcon('name')}</th>
                <th>Account #</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('entity')}>Entity{sortIcon('entity')}</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('institution')}>Institution{sortIcon('institution')}</th>
                <th>Type</th>
                <th>Ccy</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('balanceUSD')}>
                  USD Value{sortIcon('balanceUSD')}
                </th>
                <th style={{ textAlign: 'right' }}>Day Change</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.isLiability && <span className="badge" style={{ background: '#ffebee', color: '#c62828', fontSize: 9 }}>LIABILITY</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{a.accountNumber}</td>
                  <td>
                    <Link to={`/entities/${a.entity}`} style={{ fontSize: 13, fontWeight: 500 }}>
                      {a.entityData?.shortName || a.entity}
                    </Link>
                  </td>
                  <td>
                    <Link to={`/institutions/${a.institution}`}>
                      <span className="badge" style={{
                        background: `${a.institutionData?.color}15`,
                        color: a.institutionData?.color,
                        fontSize: 11
                      }}>
                        {a.institutionData?.shortName || a.institution}
                      </span>
                    </Link>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.accountType}</td>
                  <td>
                    <span className="badge" style={{ background: '#f5f5f5', color: '#333', fontSize: 10 }}>{a.currency}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {fmtCurrency(a.balance, a.currency)}
                  </td>
                  <td style={{
                    textAlign: 'right', fontWeight: 600, fontFamily: 'monospace',
                    color: a.isLiability ? 'var(--danger)' : 'var(--text-primary)'
                  }}>
                    {a.isLiability ? '-' : ''}{fmtFull(Math.abs(a.balanceUSD))}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                    {a.dayChange !== 0 ? (
                      <span style={{ color: a.dayChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {a.dayChange >= 0 ? '+' : ''}{fmtFull(a.dayChange)}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>&mdash;</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No accounts match your filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
