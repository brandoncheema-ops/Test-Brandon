import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiCheck, FiTrash2, FiSend, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import api from '../utils/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getWeekendDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  // Last Saturday
  const sat = new Date(now);
  sat.setDate(now.getDate() - day - 1 + (offset * 7));
  sat.setHours(0, 0, 0, 0);
  // Last Sunday
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  sun.setHours(0, 0, 0, 0);
  return { saturday: sat, sunday: sun };
}

function fmtDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtISO(d) {
  return d.toISOString().slice(0, 10);
}

export default function WeekendCoveragePage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [history, setHistory] = useState([]);

  const weekend = getWeekendDates(weekOffset);
  const satStr = fmtDate(weekend.saturday);
  const sunStr = fmtDate(weekend.sunday);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const startDate = fmtISO(weekend.saturday);
      const endDate = new Date(weekend.sunday);
      endDate.setHours(23, 59, 59, 999);
      const { data } = await api.get('/weekend-schedule', {
        params: { startDate, endDate: endDate.toISOString() }
      });
      setEntries(data);
    } catch {
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [weekend.saturday.toISOString(), weekend.sunday.toISOString()]);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/weekend-schedule');
      setHistory(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const createWeekendDates = async () => {
    try {
      await api.post('/weekend-schedule/bulk', {
        entries: [
          { date: fmtISO(weekend.saturday) },
          { date: fmtISO(weekend.sunday) }
        ]
      });
      toast.success('Weekend dates added');
      fetchEntries();
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create dates');
    }
  };

  const updateDoctor = async (id, doctorName) => {
    try {
      await api.put(`/weekend-schedule/${id}`, { doctorName });
      toast.success('Doctor updated');
      fetchEntries();
      fetchHistory();
    } catch {
      toast.error('Update failed');
    }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Remove this entry?')) return;
    try {
      await api.delete(`/weekend-schedule/${id}`);
      toast.success('Entry removed');
      fetchEntries();
      fetchHistory();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Group history by weekend
  const weekendGroups = {};
  history.forEach(e => {
    const d = new Date(e.date);
    const dayOfWeek = d.getDay();
    // Find the Saturday of this entry's weekend
    const sat = new Date(d);
    if (dayOfWeek === 0) sat.setDate(d.getDate() - 1); // Sunday → go back to Saturday
    const key = fmtISO(sat);
    if (!weekendGroups[key]) weekendGroups[key] = [];
    weekendGroups[key].push(e);
  });
  const sortedWeekends = Object.keys(weekendGroups).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="page-content">
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Weekend Coverage</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Track who worked each weekend</p>
        </div>
      </div>

      {/* Weekend Navigator */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: entries.length > 0 ? '1px solid var(--border)' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w - 7)}>
              <FiChevronLeft />
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, minWidth: 200, textAlign: 'center' }}>
              Weekend of {satStr} - {sunStr}
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(w => w + 7)}>
              <FiChevronRight />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(0)}>
              This Weekend
            </button>
            {entries.length === 0 && !loading && (
              <button className="btn btn-primary" onClick={createWeekendDates}>
                <FiPlus /> Add Weekend Dates
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40 }}><div className="spinner" /></div>
        ) : entries.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Doctor On Call</th>
                  <th>Notes</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => (
                  <EntryRow
                    key={entry._id}
                    entry={entry}
                    onSave={updateDoctor}
                    onDelete={deleteEntry}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No schedule entries for this weekend yet.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Click "Add Weekend Dates" to create Saturday and Sunday entries.</p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Coverage History</h3>
          <span className="badge badge-confirmed">{sortedWeekends.length} weekends</span>
        </div>
        {sortedWeekends.length > 0 ? (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Weekend</th>
                  <th>Coverage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedWeekends.slice(0, 12).map(weekendKey => {
                  const group = weekendGroups[weekendKey];
                  const sat = new Date(weekendKey);
                  const sun = new Date(weekendKey);
                  sun.setDate(sat.getDate() + 1);
                  const allFilled = group.every(e => e.doctorName);
                  const anyFilled = group.some(e => e.doctorName);

                  return (
                    <tr key={weekendKey}>
                      <td style={{ fontWeight: 600 }}>
                        {fmtDate(sat)} - {fmtDate(sun)}
                      </td>
                      <td>
                        {group.map(e => {
                          const d = new Date(e.date);
                          return (
                            <span key={e._id} style={{
                              display: 'inline-block',
                              marginRight: 12,
                              fontSize: 13
                            }}>
                              <strong>{fmtDate(d)}</strong>{' '}
                              {e.doctorName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>pending</span>}
                            </span>
                          );
                        })}
                      </td>
                      <td>
                        <span className={`badge ${allFilled ? 'badge-confirmed' : anyFilled ? 'badge-pending' : 'badge-draft'}`}>
                          {allFilled ? 'Complete' : anyFilled ? 'Partial' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>No coverage history yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryRow({ entry, onSave, onDelete }) {
  const [editing, setEditing] = useState(!entry.doctorName);
  const [name, setName] = useState(entry.doctorName || '');
  const d = new Date(entry.date);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(entry._id, name.trim());
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setName(entry.doctorName || ''); setEditing(false); }
  };

  return (
    <tr>
      <td style={{ fontWeight: 700, fontSize: 18, color: 'var(--primary)' }}>
        {fmtDate(d)}
      </td>
      <td style={{ color: 'var(--text-secondary)' }}>
        {DAYS[d.getDay()]}
      </td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ maxWidth: 250 }}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter doctor name..."
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>
              <FiCheck size={14} />
            </button>
          </div>
        ) : (
          <span
            style={{ cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {entry.doctorName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Click to add doctor...</span>}
          </span>
        )}
      </td>
      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        {entry.notes || '-'}
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6 }}>
          {!editing && entry.doctorName && (
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)} title="Edit">
              <FiSend size={14} />
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(entry._id)} title="Delete">
            <FiTrash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
