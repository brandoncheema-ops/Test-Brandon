import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authApi } from './services/api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import WorkflowDetailPage from './pages/WorkflowDetailPage';
import Layout from './components/Layout';

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    authApi.me().then((res) => setAuthenticated(res.authenticated)).catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authenticated ? <Navigate to="/" /> : <LoginPage onLogin={() => setAuthenticated(true)} />
        }
      />
      <Route
        path="/"
        element={authenticated ? <Layout /> : <Navigate to="/login" />}
      >
        <Route index element={<DashboardPage />} />
        <Route path="workflows/:id" element={<WorkflowDetailPage />} />
      </Route>
    </Routes>
  );
}
