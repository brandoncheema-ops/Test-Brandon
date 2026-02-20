import React, { useState, useEffect } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function CashFlow() {
  const [data, setData] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/companies').then(r => setCompanies(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (selectedCompany) params.company_id = selectedCompany;
    api.get('/cashflow', { params })
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [selectedCompany]);

  if (loading) return <div className="loading">Loading cash flow...</div>;
  if (!data || data.weekly.length === 0) {
    return (
      <div>
        <div className="section-header">
          <div>
            <h2>Cash Flow Analysis</h2>
            <p>Weekly cash flow breakdown</p>
          </div>
        </div>
        <div className="card">
          <div className="empty-state">
            <h3>No cash flow data</h3>
            <p>Link bank accounts and sync transactions to see cash flow analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  const { weekly } = data;
  const totalIncome = weekly.reduce((s, w) => s + w.income, 0);
  const totalExpenses = weekly.reduce((s, w) => s + w.expenses, 0);
  const totalNet = totalIncome - totalExpenses;
  const avgWeeklyNet = totalNet / weekly.length;

  // Take last 26 weeks for charts
  const recentWeeks = weekly.slice(-26);

  const barData = {
    labels: recentWeeks.map(w => w.week),
    datasets: [
      {
        label: 'Income',
        data: recentWeeks.map(w => w.income),
        backgroundColor: 'rgba(0, 184, 148, 0.7)',
        borderRadius: 4,
      },
      {
        label: 'Expenses',
        data: recentWeeks.map(w => -w.expenses),
        backgroundColor: 'rgba(225, 112, 85, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const lineData = {
    labels: recentWeeks.map(w => w.week),
    datasets: [
      {
        label: 'Running Balance',
        data: recentWeeks.map(w => w.runningBalance),
        borderColor: '#6c5ce7',
        backgroundColor: 'rgba(108, 92, 231, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
      },
      {
        label: 'Weekly Net',
        data: recentWeeks.map(w => w.net),
        borderColor: '#74b9ff',
        backgroundColor: 'rgba(116, 185, 255, 0.05)',
        fill: false,
        tension: 0.4,
        pointRadius: 2,
        borderDash: [4, 4],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { color: '#8b8fa3', font: { size: 11 } } },
      tooltip: {
        backgroundColor: '#1e2130',
        borderColor: '#2a2d3e',
        borderWidth: 1,
        callbacks: { label: ctx => `${ctx.dataset.label}: ${fmt(ctx.raw)}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(42,45,62,0.5)' }, ticks: { color: '#5c6078', font: { size: 9 }, maxRotation: 45 } },
      y: { grid: { color: 'rgba(42,45,62,0.5)' }, ticks: { color: '#5c6078', font: { size: 10 }, callback: v => fmt(v) } },
    },
  };

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Cash Flow Analysis</h2>
          <p>Weekly income, expenses, and running balance</p>
        </div>
        <select
          value={selectedCompany}
          onChange={e => setSelectedCompany(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="">All Companies</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Income</div>
          <div className="kpi-value positive">{fmt(totalIncome)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value negative">{fmt(totalExpenses)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net Cash Flow</div>
          <div className={`kpi-value ${totalNet >= 0 ? 'positive' : 'negative'}`}>{fmt(totalNet)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Weekly Net</div>
          <div className={`kpi-value ${avgWeeklyNet >= 0 ? 'positive' : 'negative'}`}>{fmt(avgWeeklyNet)}</div>
        </div>
      </div>

      {/* Running Balance Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Running Balance & Weekly Net</div>
            <div className="card-subtitle">Cumulative cash flow over time</div>
          </div>
        </div>
        <div className="chart-container" style={{ height: 350 }}>
          <Line data={lineData} options={chartOptions} />
        </div>
      </div>

      {/* Weekly Bar Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Weekly Income vs Expenses</div>
            <div className="card-subtitle">Positive = income, Negative = expenses</div>
          </div>
        </div>
        <div className="chart-container" style={{ height: 350 }}>
          <Bar data={barData} options={chartOptions} />
        </div>
      </div>

      {/* Weekly Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Weekly Breakdown</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Week Starting</th>
                <th style={{ textAlign: 'right' }}>Income</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Net</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
                <th style={{ textAlign: 'right' }}>Transactions</th>
              </tr>
            </thead>
            <tbody>
              {[...recentWeeks].reverse().map(w => (
                <tr key={w.week}>
                  <td>{w.week}</td>
                  <td style={{ textAlign: 'right' }} className="amount-positive">{fmt(w.income)}</td>
                  <td style={{ textAlign: 'right' }} className="amount-negative">{fmt(w.expenses)}</td>
                  <td style={{ textAlign: 'right' }} className={w.net >= 0 ? 'amount-positive' : 'amount-negative'}>{fmt(w.net)}</td>
                  <td style={{ textAlign: 'right' }} className={w.runningBalance >= 0 ? 'amount-positive' : 'amount-negative'}>{fmt(w.runningBalance)}</td>
                  <td style={{ textAlign: 'right' }}>{w.transactions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
