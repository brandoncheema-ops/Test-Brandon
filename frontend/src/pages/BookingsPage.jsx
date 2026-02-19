import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiMail } from 'react-icons/fi';
import api from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [filterProperty, setFilterProperty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const initialForm = {
    property: '', guestName: '', guestEmail: '', guestPhone: '',
    checkIn: '', checkOut: '', ratePerNight: '', status: 'confirmed', notes: ''
  };
  const [form, setForm] = useState(initialForm);

  const fetchBookings = useCallback(async () => {
    try {
      const params = {};
      if (filterProperty) params.property = filterProperty;
      if (filterStatus) params.status = filterStatus;
      const { data } = await api.get('/bookings', { params });
      setBookings(data);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filterProperty, filterStatus]);

  useEffect(() => {
    const fetchProps = async () => {
      try {
        const { data } = await api.get('/properties');
        setProperties(data);
      } catch (err) {
        // properties load failed silently
      }
    };
    fetchProps();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBooking) {
        await api.put(`/bookings/${editingBooking._id}`, form);
        toast.success('Booking updated');
      } else {
        await api.post('/bookings', form);
        toast.success('Booking created');
      }
      setShowModal(false);
      setEditingBooking(null);
      setForm(initialForm);
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleEdit = (booking) => {
    setEditingBooking(booking);
    setForm({
      property: booking.property?._id || booking.property,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail || '',
      guestPhone: booking.guestPhone || '',
      checkIn: booking.checkIn?.substring(0, 10) || '',
      checkOut: booking.checkOut?.substring(0, 10) || '',
      ratePerNight: booking.ratePerNight,
      status: booking.status,
      notes: booking.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this booking?')) return;
    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Booking deleted');
      fetchBookings();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleSendConfirmation = async (bookingId) => {
    try {
      // Create invoice and send
      await api.post('/invoices', { bookingId });
      toast.success('Confirmation generated');
    } catch (err) {
      toast.error('Failed to send confirmation');
    }
  };

  const openNewBooking = () => {
    setEditingBooking(null);
    setForm({ ...initialForm, property: properties[0]?._id || '' });
    setShowModal(true);
  };

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Bookings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{bookings.length} total bookings</p>
        </div>
        <button className="btn btn-primary" onClick={openNewBooking}>
          <FiPlus /> New Booking
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="form-select" style={{ width: 200 }} value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
          <option value="">All Properties</option>
          {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select className="form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="checked_in">Checked In</option>
          <option value="checked_out">Checked Out</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Guest</th>
                <th>Property</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Nights</th>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>Gross</th>
                <th style={{ textAlign: 'right' }}>Net</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600 }}>{b.guestName}</td>
                  <td>{b.property?.name || 'N/A'}</td>
                  <td>{formatDate(b.checkIn)}</td>
                  <td>{formatDate(b.checkOut)}</td>
                  <td>{b.nights}</td>
                  <td>{formatCurrency(b.ratePerNight)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(b.grossRevenue)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                    {formatCurrency(b.netIncome)}
                  </td>
                  <td>
                    <span className={`badge badge-${b.status}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(b)} title="Edit">
                        <FiEdit2 size={14} />
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleSendConfirmation(b._id)} title="Generate Invoice">
                        <FiMail size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(b._id)} title="Delete">
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                    No bookings found. Create your first booking!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">{editingBooking ? 'Edit Booking' : 'New Booking'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Property</label>
                  <select className="form-select" value={form.property} onChange={e => setForm({ ...form, property: e.target.value })} required>
                    <option value="">Select property</option>
                    {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Guest Name</label>
                  <input className="form-input" value={form.guestName} onChange={e => setForm({ ...form, guestName: e.target.value })} required />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Guest Email</label>
                    <input type="email" className="form-input" value={form.guestEmail} onChange={e => setForm({ ...form, guestEmail: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Guest Phone</label>
                    <input className="form-input" value={form.guestPhone} onChange={e => setForm({ ...form, guestPhone: e.target.value })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Check-in</label>
                    <input type="date" className="form-input" value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Check-out</label>
                    <input type="date" className="form-input" value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Rate per Night ($)</label>
                    <input type="number" className="form-input" value={form.ratePerNight} onChange={e => setForm({ ...form, ratePerNight: e.target.value })} min="0" step="0.01" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      <option value="confirmed">Confirmed</option>
                      <option value="pending">Pending</option>
                      <option value="checked_in">Checked In</option>
                      <option value="checked_out">Checked Out</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingBooking ? 'Save Changes' : 'Create Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
