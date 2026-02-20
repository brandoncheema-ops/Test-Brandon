import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { FiPlus, FiLink, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

function PlaidLinkButton({ companyId, onSuccess }) {
  const [linkToken, setLinkToken] = useState(null);

  useEffect(() => {
    api.post('/plaid/create-link-token', { company_id: companyId })
      .then(r => setLinkToken(r.data.link_token))
      .catch(e => console.error('Failed to create link token:', e));
  }, [companyId]);

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    try {
      await api.post('/plaid/exchange-token', {
        public_token: publicToken,
        company_id: companyId,
        institution: metadata.institution,
      });
      toast.success(`Linked ${metadata.institution.name} successfully!`);
      onSuccess();
    } catch (e) {
      toast.error('Failed to link account: ' + (e.response?.data?.error || e.message));
    }
  }, [companyId, onSuccess]);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <button
      className="btn btn-success btn-sm"
      onClick={() => open()}
      disabled={!ready}
    >
      <FiLink /> Link Bank Account
    </button>
  );
}

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'LLC', ein: '' });
  const [dashboard, setDashboard] = useState(null);

  const fetchCompanies = () => {
    Promise.all([
      api.get('/companies'),
      api.get('/dashboard'),
    ]).then(([companiesRes, dashRes]) => {
      setCompanies(companiesRes.data);
      setDashboard(dashRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Company name is required');
    try {
      await api.post('/companies', form);
      toast.success('Company added!');
      setShowModal(false);
      setForm({ name: '', type: 'LLC', ein: '' });
      fetchCompanies();
    } catch (e) {
      toast.error('Failed to add company');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" and all its linked accounts?`)) return;
    try {
      await api.delete(`/companies/${id}`);
      toast.success('Company deleted');
      fetchCompanies();
    } catch (e) {
      toast.error('Failed to delete company');
    }
  };

  const getCompanySummary = (id) => {
    if (!dashboard) return { income: 0, expenses: 0, net: 0, transactionCount: 0 };
    return dashboard.companySummaries.find(c => c.id === id) || { income: 0, expenses: 0, net: 0, transactionCount: 0 };
  };

  if (loading) return <div className="loading">Loading companies...</div>;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2>Companies</h2>
          <p>Manage your entities and link bank accounts via Plaid</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <FiPlus /> Add Company
        </button>
      </div>

      {companies.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No companies yet</h3>
            <p>Add your first company to start tracking financials across all your entities.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <FiPlus /> Add Your First Company
            </button>
          </div>
        </div>
      ) : (
        <div className="company-grid">
          {companies.map(c => {
            const summary = getCompanySummary(c.id);
            return (
              <div key={c.id} className="company-card">
                <div className="company-card-header">
                  <div>
                    <h3>{c.name}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {c.ein && `EIN: ${c.ein} | `}{c.accountCount || 0} accounts linked
                    </div>
                  </div>
                  <span className="type-badge">{c.type}</span>
                </div>

                <div className="company-stats">
                  <div className="company-stat">
                    <div className="company-stat-value" style={{ color: 'var(--green)' }}>{fmt(summary.income)}</div>
                    <div className="company-stat-label">Income</div>
                  </div>
                  <div className="company-stat">
                    <div className="company-stat-value" style={{ color: 'var(--red)' }}>{fmt(summary.expenses)}</div>
                    <div className="company-stat-label">Expenses</div>
                  </div>
                  <div className="company-stat">
                    <div className="company-stat-value" style={{ color: summary.net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt(summary.net)}
                    </div>
                    <div className="company-stat-label">Net</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <PlaidLinkButton companyId={c.id} onSuccess={fetchCompanies} />
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id, c.name)}>
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Company</h3>
            <form onSubmit={handleAddCompany}>
              <div className="form-group">
                <label>Company Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., NF6 Holdings LLC"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Entity Type</label>
                <select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
                  <option value="LLC">LLC</option>
                  <option value="S-Corp">S-Corp</option>
                  <option value="C-Corp">C-Corp</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Sole Proprietor">Sole Proprietor</option>
                  <option value="Trust">Trust</option>
                  <option value="Non-Profit">Non-Profit</option>
                </select>
              </div>
              <div className="form-group">
                <label>EIN (Optional)</label>
                <input
                  type="text"
                  value={form.ein}
                  onChange={e => setForm(prev => ({ ...prev, ein: e.target.value }))}
                  placeholder="XX-XXXXXXX"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Company</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
