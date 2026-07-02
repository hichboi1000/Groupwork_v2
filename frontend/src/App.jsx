import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './index.css';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Layout from './components/common/Layout';
import DashboardPage from './pages/DashboardPage';
import GroupPage from './pages/GroupPage';
import TasksPage from './pages/TasksPage';
import AssignmentsPage from './pages/AssignmentsPage';
import ProgressPage from './pages/ProgressPage';
import NotificationsPage from './pages/NotificationsPage';
import ClassManagementPage from './pages/ClassManagementPage';
import UnitsManagementPage from './pages/UnitsManagementPage';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="group" element={<GroupPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="classes" element={<ClassManagementPage />} />
            <Route path="units" element={<UnitsManagementPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
