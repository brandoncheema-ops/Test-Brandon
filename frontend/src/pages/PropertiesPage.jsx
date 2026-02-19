import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiPlus, FiEdit2, FiTrash2, FiMapPin } from 'react-icons/fi';
import api from '../utils/api';
import { formatCurrency } from '../utils/format';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const initialForm = {
    name: '', description: '', propertyType: 'villa',
    bedrooms: 3, bathrooms: 2, maxGuests: 6,
    location: { address: '', city: '', state: '', country: 'US', zipCode: '' },
    fees: { platformFeePercentage: 20, cleaningFeePerGuest: 250, defaultNightlyRate: 500 },
    amenities: ''
  };
  const [form, setForm] = useState(initialForm);

  const fetchProperties = useCallback(async () => {
    try {
      const { data } = await api.get('/properties');
      setProperties(data);
    } catch (err) {
      toast.error('Failed to load properties');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        amenities: typeof form.amenities === 'string'
          ? form.amenities.split(',').map(a => a.trim()).filter(Boolean)
          : form.amenities
      };

      if (editing) {
        await api.put(`/properties/${editing._id}`, payload);
        toast.success('Property updated');
      } else {
        await api.post('/properties', payload);
        toast.success('Property created');
      }
      setShowModal(false);
      setEditing(null);
      setForm(initialForm);
      fetchProperties();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleEdit = (prop) => {
    setEditing(prop);
    setForm({
      name: prop.name,
      description: prop.description || '',
      propertyType: prop.propertyType,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      maxGuests: prop.maxGuests,
      location: prop.location || initialForm.location,
      fees: prop.fees || initialForm.fees,
      amenities: (prop.amenities || []).join(', ')
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this property? All associated bookings will remain.')) return;
    try {
      await api.delete(`/properties/${id}`);
      toast.success('Property deleted');
      fetchProperties();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  if (loading) return <div className="page-content"><div className="spinner" /></div>;

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Properties</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{properties.length} properties</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(initialForm); setShowModal(true); }}>
          <FiPlus /> Add Property
        </button>
      </div>

      {/* Property Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
        {properties.map(prop => (
          <div key={prop._id} className="card" style={{ overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(135deg, #1a5f4a 0%, #0d3a2a 100%)',
              padding: '24px 24px 20px',
              color: 'white'
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{prop.name}</h3>
              <p style={{ fontSize: 13, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <FiMapPin size={13} />
                {prop.location?.city ? `${prop.location.city}, ${prop.location.state}` : 'No location set'}
              </p>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Type</div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>{prop.propertyType}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Beds/Baths</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{prop.bedrooms}BD / {prop.bathrooms}BA</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Max Guests</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{prop.maxGuests}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Nightly Rate</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(prop.fees?.defaultNightlyRate || 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Platform Fee</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{prop.fees?.platformFeePercentage || 0}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Cleaning Fee</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(prop.fees?.cleaningFeePerGuest || 0)}</div>
                </div>
              </div>

              {prop.amenities?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                  {prop.amenities.map((a, i) => (
                    <span key={i} style={{
                      background: 'var(--bg-light)', padding: '3px 10px', borderRadius: 20,
                      fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)'
                    }}>{a}</span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(prop)}>
                  <FiEdit2 size={14} /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(prop._id)}>
                  <FiTrash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        ))}

        {properties.length === 0 && (
          <div className="empty-state">
            <FiMapPin size={48} />
            <p>No properties yet. Add your first property!</p>
          </div>
        )}
      </div>

      {/* Property Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editing ? 'Edit Property' : 'Add Property'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Property Name</label>
                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.propertyType} onChange={e => setForm({ ...form, propertyType: e.target.value })}>
                      <option value="villa">Villa</option>
                      <option value="apartment">Apartment</option>
                      <option value="house">House</option>
                      <option value="condo">Condo</option>
                      <option value="townhouse">Townhouse</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={form.location.address} onChange={e => setForm({ ...form, location: { ...form.location, address: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-input" value={form.location.city} onChange={e => setForm({ ...form, location: { ...form.location, city: e.target.value } })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <input className="form-input" value={form.location.state} onChange={e => setForm({ ...form, location: { ...form.location, state: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Zip Code</label>
                    <input className="form-input" value={form.location.zipCode} onChange={e => setForm({ ...form, location: { ...form.location, zipCode: e.target.value } })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Bedrooms</label>
                    <input type="number" className="form-input" value={form.bedrooms} onChange={e => setForm({ ...form, bedrooms: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bathrooms</label>
                    <input type="number" className="form-input" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: parseInt(e.target.value) || 0 })} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Guests</label>
                    <input type="number" className="form-input" value={form.maxGuests} onChange={e => setForm({ ...form, maxGuests: parseInt(e.target.value) || 1 })} min="1" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Nightly Rate ($)</label>
                    <input type="number" className="form-input" value={form.fees.defaultNightlyRate} onChange={e => setForm({ ...form, fees: { ...form.fees, defaultNightlyRate: parseFloat(e.target.value) || 0 } })} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Platform Fee (%)</label>
                    <input type="number" className="form-input" value={form.fees.platformFeePercentage} onChange={e => setForm({ ...form, fees: { ...form.fees, platformFeePercentage: parseFloat(e.target.value) || 0 } })} min="0" max="100" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cleaning Fee ($)</label>
                    <input type="number" className="form-input" value={form.fees.cleaningFeePerGuest} onChange={e => setForm({ ...form, fees: { ...form.fees, cleaningFeePerGuest: parseFloat(e.target.value) || 0 } })} min="0" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Amenities (comma-separated)</label>
                  <input className="form-input" value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} placeholder="Pool, Wi-Fi, Ocean View, A/C" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
