import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SystemModeProvider } from './context/SystemModeContext';
import { TelemetryProvider } from './context/TelemetryContext';
import { ConnectionProvider } from './context/ConnectionContext';
import { ErrorBoundary } from './components/ErrorBoundary';

// Layout
import DashboardLayout from './components/DashboardLayout';

// Pages
import Login from './pages/Login';
import DashboardPage from './pages/DashboardPage';
import VehiclesPage from './pages/VehiclesPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import StudentDashboard from './pages/StudentDashboard';
import FleetAnalysisPage from './pages/FleetAnalysisPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SystemModeProvider>
          <TelemetryProvider>
            <ConnectionProvider>
              <Router>
                <Routes>
                  {/* Public route */}
                  <Route path="/login" element={<Login />} />

                  {/* Authenticated routes — wrapped in DashboardLayout */}
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/vehicles" element={<VehiclesPage />} />
                    <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
                    <Route path="/alerts" element={<AlertsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/student-dashboard" element={<StudentDashboard />} />
                    <Route path="/fleet-analysis" element={<FleetAnalysisPage />} />
                  </Route>

                  {/* Default redirect */}
                  <Route path="*" element={<Navigate to="/login" />} />
                </Routes>
              </Router>
            </ConnectionProvider>
          </TelemetryProvider>
        </SystemModeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
