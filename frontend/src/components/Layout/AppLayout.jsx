import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FiHome, FiCalendar, FiFileText, FiGrid,
  FiLogOut, FiMenu, FiX, FiMapPin, FiClipboard
} from 'react-icons/fi';

const navItems = [
  { path: '/', icon: FiHome, label: 'Dashboard' },
  { path: '/bookings', icon: FiFileText, label: 'Bookings' },
  { path: '/properties', icon: FiMapPin, label: 'Properties' },
  { path: '/calendar', icon: FiCalendar, label: 'Calendar' },
  { path: '/invoices', icon: FiGrid, label: 'Invoices' },
  { path: '/weekend-coverage', icon: FiClipboard, label: 'Weekend Coverage' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span style={{ fontSize: '24px' }}>&#9889;</span>
            NF6
          </div>
          <div className="sidebar-subtitle">Property Management</div>
          <button
            className="modal-close"
            style={{ position: 'absolute', top: 16, right: 16, display: sidebarOpen ? 'block' : 'none' }}
            onClick={() => setSidebarOpen(false)}
          >
            <FiX />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
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
            {user?.name} | NF6 Family Office
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
