import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Deterministic color for a booking based on guest name
function bookingColor(name) {
  const colors = ['#1a5f4a', '#2d7a5e', '#3498db', '#9b59b6', '#e67e22', '#1abc9c', '#e74c3c', '#34495e'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsRes, propsRes] = await Promise.all([
          api.get('/bookings', { params: { month: month + 1, year, property: selectedProperty || undefined } }),
          api.get('/properties')
        ]);
        setBookings(bookingsRes.data);
        setProperties(propsRes.data);
      } catch (err) {
        console.error('Calendar load error:', err);
      }
    };
    fetchData();
  }, [month, year, selectedProperty]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  // Generate calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Check which bookings overlap a given day
  const getBookingsForDay = (day) => {
    const date = new Date(year, month, day);
    return bookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      checkIn.setHours(0, 0, 0, 0);
      checkOut.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      return date >= checkIn && date < checkOut;
    });
  };

  const isToday = (day) => {
    const now = new Date();
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Calendar</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Booking calendar view</p>
        </div>
        <select className="form-select" style={{ width: 200 }} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
          <option value="">All Properties</option>
          {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      <div className="card">
        {/* Calendar header */}
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}><FiChevronLeft /></button>
            <h3 style={{ fontSize: 18, fontWeight: 700, minWidth: 180, textAlign: 'center' }}>
              {MONTH_NAMES[month]} {year}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}><FiChevronRight /></button>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={today}>Today</button>
        </div>

        {/* Day headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid var(--border)'
        }}>
          {DAYS.map(d => (
            <div key={d} style={{
              padding: '10px',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1
            }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: 500
        }}>
          {cells.map((day, i) => {
            const dayBookings = day ? getBookingsForDay(day) : [];
            return (
              <div key={i} style={{
                minHeight: 100,
                padding: 6,
                border: '1px solid #f0f0f0',
                background: day ? (isToday(day) ? '#f0f5f3' : 'white') : '#fafafa',
                position: 'relative'
              }}>
                {day && (
                  <>
                    <div style={{
                      fontSize: 13,
                      fontWeight: isToday(day) ? 700 : 400,
                      color: isToday(day) ? 'var(--primary)' : 'var(--text-primary)',
                      marginBottom: 4
                    }}>{day}</div>

                    {dayBookings.slice(0, 3).map((b) => (
                      <div
                        key={b._id}
                        onClick={() => setSelectedBooking(b)}
                        style={{
                          background: bookingColor(b.guestName),
                          color: 'white',
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 3,
                          marginBottom: 2,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {b.guestName}
                      </div>
                    ))}
                    {dayBookings.length > 3 && (
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{dayBookings.length - 3} more</div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Booking detail popup */}
      {selectedBooking && (
        <div className="modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedBooking.guestName}</h3>
              <button className="modal-close" onClick={() => setSelectedBooking(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <div className="kpi-label">Property</div>
                  <div style={{ fontWeight: 600 }}>{selectedBooking.property?.name || 'N/A'}</div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="kpi-label">Check-in</div>
                    <div style={{ fontWeight: 600 }}>{new Date(selectedBooking.checkIn).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Check-out</div>
                    <div style={{ fontWeight: 600 }}>{new Date(selectedBooking.checkOut).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="kpi-label">Nights</div>
                    <div style={{ fontWeight: 600 }}>{selectedBooking.nights}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Rate/Night</div>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(selectedBooking.ratePerNight)}</div>
                  </div>
                </div>
                <div className="form-row">
                  <div>
                    <div className="kpi-label">Gross Revenue</div>
                    <div style={{ fontWeight: 600 }}>{formatCurrency(selectedBooking.grossRevenue)}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Net Income</div>
                    <div style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(selectedBooking.netIncome)}</div>
                  </div>
                </div>
                <div>
                  <div className="kpi-label">Status</div>
                  <span className={`badge badge-${selectedBooking.status}`}>
                    {selectedBooking.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
