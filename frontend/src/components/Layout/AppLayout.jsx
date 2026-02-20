import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiBriefcase, FiGlobe, FiList,
  FiLogOut, FiMenu, FiX, FiDollarSign
} from 'react-icons/fi';

const navItems = [
  { path: '/', icon: FiHome, label: 'Dashboard' },
  { path: '/entities', icon: FiBriefcase, label: 'Entities' },
  { path: '/institutions', icon: FiGlobe, label: 'Institutions' },
  { path: '/accounts', icon: FiList, label: 'Accounts' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FiDollarSign size={22} />
            NF6
          </div>
          <div className="sidebar-subtitle">Family Office Dashboard</div>
          <button
            className="modal-close"
            style={{ position: 'absolute', top: 16, right: 16, display: sidebarOpen ? 'block' : 'none' }}
            onClick={() => setSidebarOpen(false)}
          >
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon />
              {item.label}
            </NavLink>
          ))}

          <div className="nav-section-label" style={{ marginTop: 24 }}>Account</div>
          <div className="nav-link" style={{ cursor: 'default', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
            {user?.name || 'User'}
          </div>
          <button
            className="nav-link"
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}
            onClick={logout}
          >
            <FiLogOut />
            Sign Out
          </button>
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.3)', zIndex: 99
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              <FiMenu />
            </button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {user?.name} | MN Family Office
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
