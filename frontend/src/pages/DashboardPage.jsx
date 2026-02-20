import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiAlertTriangle, FiBriefcase, FiGlobe } from 'react-icons/fi';
import api from '../utils/api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const fmtFull = (n) => {
  if (n === undefined || n === null) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
};

const fmtCompact = (n) => {
  if (n === undefined || n === null) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtCurrency = (n, currency) => {
  if (currency === 'COP') {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
  }
  if (currency === 'EUR') {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
  }
  return fmtFull(n);
};

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;
  if (!data) return <div className="page-content"><p>Failed to load dashboard data.</p></div>;

  const { summary, topAccounts, entities, institutions } = data;

  // Donut chart: Assets by Institution
  const instLabels = Object.keys(summary.byInstitution);
  const instAssets = instLabels.map(k => summary.byInstitution[k].assets);
  const instColors = instLabels.map(k => summary.byInstitution[k].color);

  const donutData = {
    labels: instLabels,
    datasets: [{
      data: instAssets,
      backgroundColor: instColors,
      borderWidth: 2,
      borderColor: '#fff',
    }]
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${fmtFull(ctx.parsed)}`
        }
      }
    }
  };

  // Bar chart: Assets by Entity Type
  const typeLabels = Object.keys(summary.byEntityType);
  const typeAssets = typeLabels.map(k => summary.byEntityType[k].assets);
  const typeLiabilities = typeLabels.map(k => summary.byEntityType[k].liabilities);

  const barData = {
    labels: typeLabels,
    datasets: [
      {
        label: 'Assets',
        data: typeAssets,
        backgroundColor: '#1a5f4a',
        borderRadius: 4,
      },
      {
        label: 'Liabilities',
        data: typeLiabilities,
        backgroundColor: '#d84040',
        borderRadius: 4,
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${fmtFull(ctx.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => fmtCompact(v), font: { size: 10 } },
        grid: { color: '#f0f0f0' }
      },
      x: {
        ticks: { font: { size: 10 } },
        grid: { display: false }
      }
    }
  };

  const dayChangePositive = summary.totalDayChange >= 0;

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ fontSize: 26 }}>MN Family Office</h1>
        <p className="page-subtitle">
          Executive Overview &mdash; Last updated {new Date(summary.lastUpdated).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="kpi-card" style={{ borderTop: '3px solid var(--primary)' }}>
          <div className="kpi-label"><FiDollarSign style={{ marginRight: 4 }} /> Net Worth</div>
          <div className="kpi-value">{fmtFull(summary.netWorth)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.entityCount} entities &middot; {summary.institutionCount} institutions
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '3px solid var(--success)' }}>
          <div className="kpi-label"><FiTrendingUp style={{ marginRight: 4 }} /> Total Assets</div>
          <div className="kpi-value positive">{fmtFull(summary.totalAssets)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {summary.accountCount} accounts total
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: '3px solid var(--danger)' }}>
          <div className="kpi-label"><FiAlertTriangle style={{ marginRight: 4 }} /> Liabilities</div>
          <div className="kpi-value negative">{fmtFull(summary.totalLiabilities)}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Mortgage &amp; loans
          </div>
        </div>
        <div className="kpi-card" style={{ borderTop: `3px solid ${dayChangePositive ? 'var(--success)' : 'var(--danger)'}` }}>
          <div className="kpi-label">
            {dayChangePositive ? <FiTrendingUp style={{ marginRight: 4 }} /> : <FiTrendingDown style={{ marginRight: 4 }} />}
            Day Change
          </div>
          <div className={`kpi-value ${dayChangePositive ? 'positive' : 'negative'}`}>
            {dayChangePositive ? '+' : ''}{fmtFull(summary.totalDayChange)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            From Schwab brokerage accounts
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Assets by Institution</span>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <Doughnut data={donutData} options={donutOptions} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Assets vs Liabilities by Entity Type</span>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </div>

      {/* Currency Holdings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card" style={{ background: 'linear-gradient(135deg, #1a5f4a 0%, #2d7a5e 100%)', color: 'white' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FiDollarSign size={20} />
              <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>USD Holdings</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtFull(summary.byCurrency.USD || 0)}</div>
          </div>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #1a3c6e 0%, #2c5f9e 100%)', color: 'white' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FiGlobe size={20} />
              <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>EUR Holdings</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtCurrency(summary.byCurrency.EUR || 0, 'EUR')}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              ~ {fmtFull((summary.byCurrency.EUR || 0) * summary.exchangeRates.EUR)} USD
            </div>
          </div>
        </div>
        <div className="card" style={{ background: 'linear-gradient(135deg, #6c3483 0%, #8e44ad 100%)', color: 'white' }}>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <FiGlobe size={20} />
              <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>COP Holdings</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtCurrency(summary.byCurrency.COP || 0, 'COP')}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
              ~ {fmtFull((summary.byCurrency.COP || 0) * summary.exchangeRates.COP)} USD (1 USD = $3,688 COP)
            </div>
          </div>
        </div>
      </div>

      {/* Top Accounts Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Top Accounts by Value</span>
          <Link to="/accounts" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Entity</th>
                <th>Institution</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
                <th style={{ textAlign: 'right' }}>USD Value</th>
                <th style={{ textAlign: 'right' }}>Day Change</th>
              </tr>
            </thead>
            <tbody>
              {topAccounts.map(a => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.accountNumber}</div>
                  </td>
                  <td>
                    <Link to={`/entities/${a.entity}`} style={{ fontSize: 13 }}>
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
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {fmtCurrency(a.balance, a.currency)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {fmtFull(a.balanceUSD)}
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

      {/* Entity Summary + Institution Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Entities */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FiBriefcase style={{ marginRight: 6 }} /> Entities ({entities.length})</span>
            <Link to="/entities" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Net Worth</th>
                  <th style={{ textAlign: 'center' }}>Accts</th>
                </tr>
              </thead>
              <tbody>
                {entities.slice(0, 12).map(e => (
                  <tr key={e._id}>
                    <td>
                      <Link to={`/entities/${e._id}`} style={{ fontWeight: 600, fontSize: 13 }}>
                        {e.shortName}
                      </Link>
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#f0f0f0', color: '#555', fontSize: 10 }}>
                        {e.type}
                      </span>
                    </td>
                    <td style={{
                      textAlign: 'right', fontWeight: 600, fontFamily: 'monospace',
                      color: e.netWorth >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {fmtFull(e.netWorth)}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      {e.accountCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Institutions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FiGlobe style={{ marginRight: 6 }} /> Institutions ({institutions.length})</span>
            <Link to="/institutions" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Net Value</th>
                  <th style={{ textAlign: 'center' }}>Accts</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map(i => (
                  <tr key={i._id}>
                    <td>
                      <Link to={`/institutions/${i._id}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white',
                          background: i.color, flexShrink: 0
                        }}>
                          {i.logo}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{i.shortName}</span>
                      </Link>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{i.type}</td>
                    <td style={{
                      textAlign: 'right', fontWeight: 600, fontFamily: 'monospace',
                      color: i.netValue >= 0 ? 'var(--success)' : 'var(--danger)'
                    }}>
                      {fmtFull(i.netValue)}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      {i.accountCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
