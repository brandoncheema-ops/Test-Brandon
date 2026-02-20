import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase, FiSearch, FiChevronRight } from 'react-icons/fi';
import api from '../utils/api';

const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

export default function EntitiesPage() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    api.get('/entities')
      .then(res => setEntities(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  const types = ['All', ...new Set(entities.map(e => e.type))];

  const filtered = entities.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) ||
                          e.shortName.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'All' || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const totalNetWorth = filtered.reduce((sum, e) => sum + e.netWorth, 0);

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Entities</h1>
        <p className="page-subtitle">{entities.length} family office entities</p>
      </div>

      {/* Summary */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Entities</div>
          <div className="kpi-value">{filtered.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Combined Net Worth</div>
          <div className="kpi-value" style={{ fontSize: 22, color: totalNetWorth >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {fmtFull(totalNetWorth)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Accounts</div>
          <div className="kpi-value">{filtered.reduce((s, e) => s + e.accountCount, 0)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <FiSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search entities..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="form-select" style={{ width: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Entity Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340, 1fr))', gap: 16 }}>
        {filtered.map(entity => (
          <Link key={entity._id} to={`/entities/${entity._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                 onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
              <div className="card-body" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <FiBriefcase size={16} style={{ color: 'var(--primary)' }} />
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{entity.shortName}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      {entity.name !== entity.shortName ? entity.name : entity.jurisdiction}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: '#f0f0f0', color: '#555' }}>{entity.type}</span>
                      <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>{entity.jurisdiction}</span>
                      <span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>{entity.accountCount} accts</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 120 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>
                      Net Worth
                    </div>
                    <div style={{
                      fontSize: 18, fontWeight: 700, fontFamily: 'monospace',
                      color: entity.netWorth >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {fmtFull(entity.netWorth)}
                    </div>
                    {entity.dayChange !== 0 && (
                      <div style={{ fontSize: 12, color: entity.dayChange >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
                        {entity.dayChange >= 0 ? '+' : ''}{fmtFull(entity.dayChange)}
                      </div>
                    )}
                    <FiChevronRight style={{ marginTop: 8, color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
