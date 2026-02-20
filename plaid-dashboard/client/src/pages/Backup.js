import React, { useState, useEffect } from 'react';
import { FiUploadCloud, FiRefreshCw, FiExternalLink, FiClock, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';

export default function Backup() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const [syncing, setSyncing] = useState(null);

  useEffect(() => {
    api.get('/sheets/history')
      .then(r => { setHistory(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const r = await api.post('/sheets/backup');
      toast.success('Backup created successfully!');
      setHistory(prev => [...prev, {
        spreadsheetId: r.data.spreadsheetId,
        spreadsheetUrl: r.data.spreadsheetUrl,
        backedUpAt: r.data.backedUpAt,
        totalTransactions: r.data.totalTransactions,
        totalCompanies: r.data.totalCompanies,
      }]);
    } catch (e) {
      const msg = e.response?.data?.hint || e.response?.data?.error || 'Backup failed';
      toast.error(msg);
    }
    setBacking(false);
  };

  const handleSync = async (spreadsheetId) => {
    setSyncing(spreadsheetId);
    try {
      await api.post('/sheets/sync', { spreadsheetId });
      toast.success('Sheet updated with latest data!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Sync failed');
    }
    setSyncing(null);
  };

  if (loading) return <div className="loading">Loading backup history...</div>;

  return (
    <div>
      <div className="section-header">
        <div>
          <h2><FiUploadCloud style={{ verticalAlign: 'middle', marginRight: 8 }} />Google Sheets Backup</h2>
          <p>Back up all financial data to a nicely organized Google Sheet</p>
        </div>
        <button className="btn btn-primary" onClick={handleBackup} disabled={backing}>
          <FiUploadCloud />
          {backing ? 'Creating Backup...' : 'Create New Backup'}
        </button>
      </div>

      {/* How it works */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <div className="card-title">What Gets Backed Up</div>
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { tab: 'Dashboard Summary', desc: 'KPIs, totals, and per-company breakdown' },
              { tab: 'Companies', desc: 'All companies with account counts' },
              { tab: 'Accounts', desc: 'Bank accounts, types, and balances' },
              { tab: 'Transactions', desc: 'Every transaction with full detail' },
              { tab: 'Cash Flow (Monthly)', desc: 'Monthly income, expenses, and net' },
              { tab: 'Category Breakdown', desc: 'Spending by category with totals' },
            ].map(item => (
              <div key={item.tab} style={{
                padding: 12,
                borderRadius: 8,
                background: 'var(--card-bg, rgba(255,255,255,0.05))',
                border: '1px solid var(--border, rgba(255,255,255,0.1))',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{item.tab}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Backup History */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title"><FiClock style={{ verticalAlign: 'middle', marginRight: 8 }} />Backup History</div>
            <div className="card-subtitle">{history.length} backup{history.length !== 1 ? 's' : ''} created</div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Companies</th>
                <th>Transactions</th>
                <th>Google Sheet</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    <FiUploadCloud size={32} style={{ marginBottom: 8, opacity: 0.5 }} /><br />
                    No backups yet. Click "Create New Backup" to back up your data to Google Sheets.
                  </td>
                </tr>
              ) : (
                [...history].reverse().map((b, idx) => (
                  <tr key={idx}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <FiCheckCircle style={{ color: 'var(--green, #22c55e)', marginRight: 6, verticalAlign: 'middle' }} />
                      {new Date(b.backedUpAt).toLocaleString()}
                    </td>
                    <td>{b.totalCompanies}</td>
                    <td>{b.totalTransactions?.toLocaleString()}</td>
                    <td>
                      <a
                        href={b.spreadsheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent, #3b82f6)', textDecoration: 'none' }}
                      >
                        Open Sheet <FiExternalLink style={{ verticalAlign: 'middle' }} />
                      </a>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => handleSync(b.spreadsheetId)}
                        disabled={syncing === b.spreadsheetId}
                      >
                        <FiRefreshCw className={syncing === b.spreadsheetId ? 'spinning' : ''} />
                        {syncing === b.spreadsheetId ? 'Updating...' : 'Update'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Setup instructions if no backups yet */}
      {history.length === 0 && (
        <div className="card" style={{ marginTop: 24, borderColor: 'var(--yellow, #eab308)' }}>
          <div className="card-header">
            <div>
              <div className="card-title" style={{ color: 'var(--yellow, #eab308)' }}>
                <FiAlertTriangle style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Setup Required
              </div>
            </div>
          </div>
          <div style={{ padding: '0 20px 20px', fontSize: 13, lineHeight: 1.8 }}>
            <p>To enable Google Sheets backup, you need a Google Service Account:</p>
            <ol style={{ paddingLeft: 20 }}>
              <li>Go to <strong>Google Cloud Console</strong> → Create a project</li>
              <li>Enable the <strong>Google Sheets API</strong> and <strong>Google Drive API</strong></li>
              <li>Create a <strong>Service Account</strong> → Generate a JSON key</li>
              <li>Add the JSON key to your <code>.env</code> file as:<br />
                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
                  GOOGLE_SERVICE_ACCOUNT_JSON=&#123;"type":"service_account",...&#125;
                </code>
              </li>
              <li>Restart the server</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
