import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiDownload, FiSend, FiFileText } from 'react-icons/fi';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const { data } = await api.get('/invoices', { params });
      setInvoices(data);
    } catch (err) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      const { data } = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download PDF');
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    try {
      await api.post(`/invoices/${invoiceId}/send`);
      toast.success('Invoice sent to guest');
      fetchInvoices();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invoice');
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    try {
      await api.put(`/invoices/${invoiceId}`, { status: 'paid', paidDate: new Date() });
      toast.success('Invoice marked as paid');
      fetchInvoices();
    } catch (err) {
      toast.error('Failed to update invoice');
    }
  };

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  // Summary
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalOutstanding = totalInvoiced - totalPaid;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Invoices</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{invoices.length} invoices</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Invoiced</div>
          <div className="kpi-value">{formatCurrency(totalInvoiced)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Paid</div>
          <div className="kpi-value positive">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value negative">{formatCurrency(totalOutstanding)}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 16 }}>
        <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Invoices Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Guest</th>
                <th>Property</th>
                <th>Date</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv._id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                  <td>{inv.guestName}</td>
                  <td>{inv.property?.name || 'N/A'}</td>
                  <td>{formatDate(inv.createdAt)}</td>
                  <td>{inv.dueDate ? formatDate(inv.dueDate) : '-'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(inv.total)}</td>
                  <td>
                    <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadPDF(inv._id, inv.invoiceNumber)} title="Download PDF">
                        <FiDownload size={14} />
                      </button>
                      {inv.status !== 'paid' && (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleSendInvoice(inv._id)} title="Send to Guest">
                            <FiSend size={14} />
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleMarkPaid(inv._id)} title="Mark as Paid">
                            Paid
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    <FiFileText size={32} style={{ marginBottom: 12, opacity: 0.4, display: 'block', margin: '0 auto 12px' }} />
                    No invoices yet. Generate an invoice from a booking.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
