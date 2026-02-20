import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiArrowLeft, FiBriefcase, FiMapPin } from 'react-icons/fi';
import api from '../utils/api';

const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const fmtCurrency = (n, currency) => {
  if (currency === 'COP') return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  if (currency === 'EUR') return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  return fmtFull(n);
};

export default function EntityDetailPage() {
  const { id } = useParams();
  const [entity, setEntity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/entities/${id}`)
      .then(res => setEntity(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;
  if (!entity) return <div className="page-content"><p>Entity not found.</p></div>;

  return (
    <div className="page-content">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 20 }}>
        <Link to="/entities" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <FiArrowLeft size={14} /> Back to Entities
        </Link>
      </div>

      {/* Entity Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <FiBriefcase size={22} style={{ color: 'var(--primary)' }} />
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>{entity.name}</h1>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ background: '#f0f0f0', color: '#555' }}>{entity.type}</span>
                <span className="badge" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                  <FiMapPin size={10} style={{ marginRight: 4 }} />{entity.jurisdiction}
                </span>
              </div>
              {entity.description && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>{entity.description}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Assets</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{fmtFull(entity.totalAssets)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Liabilities</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: entity.totalLiabilities > 0 ? 'var(--danger)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {entity.totalLiabilities > 0 ? `-${fmtFull(entity.totalLiabilities)}` : '$0.00'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Net Worth</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: entity.netWorth >= 0 ? 'var(--primary)' : 'var(--danger)', fontFamily: 'monospace' }}>
                  {fmtFull(entity.netWorth)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Accounts ({entity.accounts?.length || 0})</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Account #</th>
                <th>Institution</th>
                <th>Type</th>
                <th>Currency</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'right' }}>USD Value</th>
                <th style={{ textAlign: 'right' }}>Day Change</th>
              </tr>
            </thead>
            <tbody>
              {(entity.accounts || []).map(a => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.isLiability && <span className="badge" style={{ background: '#ffebee', color: '#c62828', fontSize: 9, marginTop: 2 }}>LIABILITY</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{a.accountNumber}</td>
                  <td>
                    <Link to={`/institutions/${a.institution}`}>
                      <span className="badge" style={{
                        background: `${a.institutionData?.color}15`,
                        color: a.institutionData?.color,
                        fontSize: 11
                      }}>
                        {a.institutionData?.shortName}
                      </span>
                    </Link>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.accountType}</td>
                  <td>
                    <span className="badge" style={{ background: '#f5f5f5', color: '#333', fontSize: 10 }}>{a.currency}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {a.isLiability && <span style={{ color: 'var(--danger)' }}>-</span>}
                    {fmtCurrency(a.balance, a.currency)}
                  </td>
                  <td style={{
                    textAlign: 'right', fontWeight: 600, fontFamily: 'monospace',
                    color: a.isLiability ? 'var(--danger)' : 'var(--success)'
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
              {(!entity.accounts || entity.accounts.length === 0) && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No accounts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
