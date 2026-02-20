import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiActivity } from 'react-icons/fi';
import api from '../api';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
);

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => {
      setData(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (!data) return <div className="empty-state"><h3>No data available</h3><p>Add companies and link bank accounts to see your dashboard.</p></div>;

  const { kpis, monthlyCashFlow, expensesByCategory, companySummaries, recentTransactions } = data;

  const cashFlowChart = {
    labels: monthlyCashFlow.map(m => m.label),
    datasets: [
      {
        label: 'Income',
        data: monthlyCashFlow.map(m => m.income),
        borderColor: '#00b894',
        backgroundColor: 'rgba(0, 184, 148, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Expenses',
        data: monthlyCashFlow.map(m => m.expenses),
        borderColor: '#e17055',
        backgroundColor: 'rgba(225, 112, 85, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Net',
        data: monthlyCashFlow.map(m => m.net),
        borderColor: '#74b9ff',
        backgroundColor: 'rgba(116, 185, 255, 0.1)',
        fill: true,
        tension: 0.4,
        borderDash: [5, 5],
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
        titleColor: '#e4e6f0',
        bodyColor: '#8b8fa3',
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw)}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(42,45,62,0.5)' }, ticks: { color: '#5c6078', font: { size: 10 } } },
      y: { grid: { color: 'rgba(42,45,62,0.5)' }, ticks: { color: '#5c6078', font: { size: 10 }, callback: v => fmt(v) } },
    },
  };

  const categoryColors = ['#6c5ce7', '#00b894', '#e17055', '#74b9ff', '#fdcb6e', '#a29bfe', '#55efc4', '#fab1a0', '#81ecec', '#ffeaa7'];
  const categoryChart = {
    labels: expensesByCategory.map(c => c.category),
    datasets: [{
      data: expensesByCategory.map(c => c.amount),
      backgroundColor: categoryColors.slice(0, expensesByCategory.length),
      borderWidth: 0,
    }],
  };

  const companyChart = {
    labels: companySummaries.map(c => c.name),
    datasets: [
      {
        label: 'Income',
        data: companySummaries.map(c => c.income),
        backgroundColor: 'rgba(0, 184, 148, 0.7)',
        borderRadius: 6,
      },
      {
        label: 'Expenses',
        data: companySummaries.map(c => c.expenses),
        backgroundColor: 'rgba(225, 112, 85, 0.7)',
        borderRadius: 6,
      },
    ],
  };

  const incomeChange = kpis.lastMonthIncome > 0
    ? ((kpis.monthIncome - kpis.lastMonthIncome) / kpis.lastMonthIncome * 100).toFixed(1)
    : 0;
  const expenseChange = kpis.lastMonthExpenses > 0
    ? ((kpis.monthExpenses - kpis.lastMonthExpenses) / kpis.lastMonthExpenses * 100).toFixed(1)
    : 0;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of all companies and financial activity</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Income</div>
          <div className="kpi-value positive">{fmt(kpis.totalIncome)}</div>
          <div className={`kpi-change ${parseFloat(incomeChange) >= 0 ? 'up' : 'down'}`}>
            {incomeChange >= 0 ? '+' : ''}{incomeChange}% vs last month
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Expenses</div>
          <div className="kpi-value negative">{fmt(kpis.totalExpenses)}</div>
          <div className={`kpi-change ${parseFloat(expenseChange) <= 0 ? 'up' : 'down'}`}>
            {expenseChange >= 0 ? '+' : ''}{expenseChange}% vs last month
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net Cash Flow</div>
          <div className={`kpi-value ${kpis.netCashFlow >= 0 ? 'positive' : 'negative'}`}>
            {fmt(kpis.netCashFlow)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">This Month</div>
          <div className={`kpi-value ${kpis.monthNet >= 0 ? 'positive' : 'negative'}`}>
            {fmt(kpis.monthNet)}
          </div>
          <div className="kpi-change">{fmt(kpis.monthIncome)} in / {fmt(kpis.monthExpenses)} out</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Companies</div>
          <div className="kpi-value neutral">{kpis.totalCompanies}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Linked Accounts</div>
          <div className="kpi-value neutral">{kpis.totalAccounts}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Transactions</div>
          <div className="kpi-value neutral">{kpis.totalTransactions.toLocaleString()}</div>
        </div>
      </div>

      {/* Cash Flow Chart */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Cash Flow Trend</div>
            <div className="card-subtitle">Income, expenses, and net over the last 12 months</div>
          </div>
        </div>
        <div className="chart-container">
          <Line data={cashFlowChart} options={chartOptions} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Expenses by Category</div>
              <div className="card-subtitle">Top spending categories</div>
            </div>
          </div>
          <div className="chart-container" style={{ height: 250 }}>
            <Doughnut
              data={categoryChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { color: '#8b8fa3', font: { size: 11 }, padding: 12 } },
                  tooltip: {
                    backgroundColor: '#1e2130',
                    borderColor: '#2a2d3e',
                    borderWidth: 1,
                    callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)}` },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Company Comparison</div>
              <div className="card-subtitle">Income vs Expenses by entity</div>
            </div>
          </div>
          <div className="chart-container" style={{ height: 250 }}>
            <Bar
              data={companyChart}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  legend: { position: 'top', labels: { color: '#8b8fa3', font: { size: 11 } } },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Company Summaries */}
      {companySummaries.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div className="card-title">Company P&L Summary</div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'right' }}>Income</th>
                  <th style={{ textAlign: 'right' }}>Expenses</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                  <th style={{ textAlign: 'right' }}>Transactions</th>
                </tr>
              </thead>
              <tbody>
                {companySummaries.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td><span className="badge badge-transfer">{c.type}</span></td>
                    <td style={{ textAlign: 'right' }} className="amount-positive">{fmt(c.income)}</td>
                    <td style={{ textAlign: 'right' }} className="amount-negative">{fmt(c.expenses)}</td>
                    <td style={{ textAlign: 'right' }} className={c.net >= 0 ? 'amount-positive' : 'amount-negative'}>{fmt(c.net)}</td>
                    <td style={{ textAlign: 'right' }}>{c.transactionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Recent Transactions</div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Company</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No transactions yet. Link a bank account to get started.</td></tr>
              ) : (
                recentTransactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.merchant_name || t.name}</td>
                    <td><span className="badge badge-transfer">{t.company_name}</span></td>
                    <td>{t.category}</td>
                    <td style={{ textAlign: 'right' }} className={t.amount > 0 ? 'amount-negative' : 'amount-positive'}>
                      {t.amount > 0 ? '-' : '+'}{fmt(Math.abs(t.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
