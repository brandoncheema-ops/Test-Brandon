import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiGlobe } from 'react-icons/fi';
import api from '../utils/api';

const fmtFull = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);

const fmtCurrency = (n, currency) => {
  if (currency === 'COP') return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  if (currency === 'EUR') return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  return fmtFull(n);
};

function InstitutionsList() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/institutions')
      .then(res => setInstitutions(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title">Institutions</h1>
        <p className="page-subtitle">{institutions.length} financial institutions</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {institutions.map(inst => (
          <Link key={inst._id} to={`/institutions/${inst._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card" style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                 onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                 onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}>
              <div className="card-body" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white',
                    background: inst.color, flexShrink: 0
                  }}>
                    {inst.logo}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{inst.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inst.type} &middot; {inst.country}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Net Value</div>
                    <div style={{
                      fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                      color: inst.netValue >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {fmtFull(inst.netValue)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Accounts</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{inst.accountCount}</div>
                  </div>
                </div>
                {inst.totalLiabilities > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>
                    Includes {fmtFull(inst.totalLiabilities)} in liabilities
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InstitutionDetail() {
  const { id } = useParams();
  const [inst, setInst] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/institutions/${id}`)
      .then(res => setInst(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;
  if (!inst) return <div className="page-content"><p>Institution not found.</p></div>;

  return (
    <div className="page-content">
      <div style={{ marginBottom: 20 }}>
        <Link to="/institutions" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
          <FiArrowLeft size={14} /> Back to Institutions
        </Link>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{
                width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'white',
                background: inst.color, flexShrink: 0
              }}>
                {inst.logo}
              </span>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>{inst.name}</h1>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span className="badge" style={{ background: '#f0f0f0', color: '#555' }}>{inst.type}</span>
                  <span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                    <FiGlobe size={10} style={{ marginRight: 4 }} />{inst.country}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Assets</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)', fontFamily: 'monospace' }}>{fmtFull(inst.totalAssets)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Liabilities</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: inst.totalLiabilities > 0 ? 'var(--danger)' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {inst.totalLiabilities > 0 ? `-${fmtFull(inst.totalLiabilities)}` : '$0.00'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 1 }}>Net Value</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: inst.netValue >= 0 ? 'var(--primary)' : 'var(--danger)', fontFamily: 'monospace' }}>
                  {fmtFull(inst.netValue)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Accounts ({inst.accounts?.length || 0})</span>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Account #</th>
                <th>Entity</th>
                <th>Type</th>
                <th>Currency</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'right' }}>USD Value</th>
                <th style={{ textAlign: 'right' }}>Day Change</th>
              </tr>
            </thead>
            <tbody>
              {(inst.accounts || []).map(a => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    {a.isLiability && <span className="badge" style={{ background: '#ffebee', color: '#c62828', fontSize: 9, marginTop: 2 }}>LIABILITY</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{a.accountNumber}</td>
                  <td>
                    <Link to={`/entities/${a.entity}`} style={{ fontSize: 13, fontWeight: 600 }}>
                      {a.entityData?.shortName}
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export { InstitutionsList, InstitutionDetail };
export default InstitutionsList;
