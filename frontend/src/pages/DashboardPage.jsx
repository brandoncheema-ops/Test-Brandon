import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import api from '../utils/api';
import { formatCurrency, getMonthName } from '../utils/format';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Title, Tooltip, Legend, Filler
);

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [year] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, bookingsRes, propsRes] = await Promise.all([
          api.get(`/bookings/summary?year=${year}`),
          api.get(`/bookings?year=${year}`),
          api.get('/properties')
        ]);
        setSummary(summaryRes.data);
        setBookings(bookingsRes.data);
        setProperties(propsRes.data);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [year]);

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  const monthLabels = Object.keys(summary?.monthly || {}).map(i => getMonthName(parseInt(i)).substring(0, 3));
  const monthlyRevenue = Object.values(summary?.monthly || {}).map(m => m.revenue);
  const monthlyNet = Object.values(summary?.monthly || {}).map(m => m.net);

  // Revenue chart
  const revenueChartData = {
    labels: monthLabels,
    datasets: [
      {
        label: 'Gross Revenue',
        data: monthlyRevenue,
        borderColor: '#1a5f4a',
        backgroundColor: 'rgba(26, 95, 74, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#1a5f4a'
      },
      {
        label: 'Net Income',
        data: monthlyNet,
        borderColor: '#2d7a5e',
        backgroundColor: 'rgba(45, 122, 94, 0.05)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2d7a5e'
      }
    ]
  };

  // Fee breakdown donut
  const feeChartData = {
    labels: ['Net Income', 'Platform Fees', 'Cleaning Fees'],
    datasets: [{
      data: [
        summary?.netIncome || 0,
        summary?.platformFees || 0,
        summary?.cleaningFees || 0
      ],
      backgroundColor: ['#2d7a5e', '#d84040', '#e6a817'],
      borderWidth: 0
    }]
  };

  // Occupancy bar chart
  const occupancyData = {
    labels: monthLabels,
    datasets: [{
      label: 'Nights Booked',
      data: Object.values(summary?.monthly || {}).map(m => m.nights),
      backgroundColor: 'rgba(26, 95, 74, 0.7)',
      borderRadius: 6
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { padding: 20 } } },
    scales: { y: { beginAtZero: true } }
  };

  return (
    <div className="page-content">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Year-to-date overview for {year} | {properties.length} {properties.length === 1 ? 'property' : 'properties'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Guests</div>
          <div className="kpi-value">{summary?.totalGuests || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Nights</div>
          <div className="kpi-value">{summary?.totalNights || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Occupancy Rate</div>
          <div className="kpi-value">{summary?.occupancyRate || 0}%</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Gross Revenue</div>
          <div className="kpi-value">{formatCurrency(summary?.grossRevenue || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Fees</div>
          <div className="kpi-value negative">{formatCurrency(summary?.totalFees || 0)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Net Income</div>
          <div className="kpi-value positive">{formatCurrency(summary?.netIncome || 0)}</div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Monthly Revenue</span>
          </div>
          <div className="card-body" style={{ height: 300 }}>
            <Line data={revenueChartData} options={chartOptions} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue Breakdown</span>
          </div>
          <div className="card-body" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Doughnut data={feeChartData} options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom', labels: { padding: 16 } } }
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Occupancy by Month</span>
          </div>
          <div className="card-body" style={{ height: 280 }}>
            <Bar data={occupancyData} options={chartOptions} />
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Bookings</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Guest</th>
                    <th>Property</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 5).map(b => (
                    <tr key={b._id}>
                      <td style={{ fontWeight: 600 }}>{b.guestName}</td>
                      <td>{b.property?.name || 'N/A'}</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(b.grossRevenue)}</td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No bookings yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
