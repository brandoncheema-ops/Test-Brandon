import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FiHome, FiDollarSign, FiList, FiPieChart, FiShield, FiSettings, FiMenu, FiX, FiRefreshCw, FiUploadCloud } from 'react-icons/fi';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Companies from './pages/Companies';
import CashFlow from './pages/CashFlow';
import Audit from './pages/Audit';
import Backup from './pages/Backup';
import Accounts from './pages/Accounts';
import api from './api';
import './styles.css';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post('/plaid/sync');
      window.location.reload();
    } catch (e) {
      console.error('Sync failed:', e);
    }
    setSyncing(false);
  };

  const navItems = [
    { path: '/', icon: <FiHome />, label: 'Dashboard' },
    { path: '/transactions', icon: <FiList />, label: 'Transactions' },
    { path: '/companies', icon: <FiSettings />, label: 'Companies' },
    { path: '/accounts', icon: <FiDollarSign />, label: 'Accounts' },
    { path: '/cashflow', icon: <FiPieChart />, label: 'Cash Flow' },
    { path: '/audit', icon: <FiShield />, label: 'Audit' },
    { path: '/backup', icon: <FiUploadCloud />, label: 'Backup' },
  ];

  return (
    <Router>
      <div className="app">
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <h1 className="logo">NF6</h1>
            <span className="logo-sub">Family Office</span>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-footer">
            <button className="sync-btn" onClick={handleSync} disabled={syncing}>
              <FiRefreshCw className={syncing ? 'spinning' : ''} />
              {syncing ? 'Syncing...' : 'Sync All'}
            </button>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <button className="menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <FiX /> : <FiMenu />}
            </button>
            <h2 className="page-title">Family Office Financial Dashboard</h2>
            <div className="topbar-right">
              <span className="env-badge">SANDBOX</span>
            </div>
          </header>

          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/cashflow" element={<CashFlow />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/backup" element={<Backup />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
      <ToastContainer position="bottom-right" theme="dark" />
    </Router>
  );
}

export default App;
