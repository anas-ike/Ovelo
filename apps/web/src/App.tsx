import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { Landing } from './pages/Landing';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { VerifyEmail } from './pages/auth/VerifyEmail';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ResetPassword } from './pages/auth/ResetPassword';
import { AdminLogin } from './pages/admin/AdminLogin';
import { lazy, Suspense } from 'react';
import { AdminProtectedRoute } from './layouts/AdminProtectedRoute';
import { AdminRecovery } from './pages/admin/AdminRecovery';
import { QrRedirect } from './pages/QrRedirect';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { AddItem } from './pages/AddItem';
import { ItemDetail } from './pages/ItemDetail';
import { GenericPage } from './pages/GenericPage';
import { Documents } from './pages/Documents';
import { Locations } from './pages/Locations';
import { Scan } from './pages/Scan';
import { PublicInfo } from './pages/PublicInfo';
import { Activity } from './pages/Activity';
const AdminPage = lazy(() => import('./pages/admin/AdminPage').then(m => ({ default: m.AdminPage })));
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/how-it-works" element={<PublicInfo kind="help" />} />
      <Route path="/terms" element={<PublicInfo kind="terms" />} />
      <Route path="/privacy" element={<PublicInfo kind="privacy" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/forgot-password" element={<AdminRecovery />} />
      <Route path="/admin/reset-password" element={<AdminRecovery reset />} />
      <Route element={<AdminProtectedRoute />}><Route path="/admin/*" element={<Suspense fallback={<p>Loading administrator page…</p>}><AdminPage /></Suspense>} /></Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/i/:code" element={<QrRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/add-item" element={<AddItem />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route path="/item/:id/edit" element={<AddItem />} />
          <Route path="/scan" element={<Scan />} />
          <Route
            path="/activity"
            element={
              <Activity />
            }
          />
          <Route
            path="/locations"
            element={
              <Locations />
            }
          />
          <Route
            path="/containers"
            element={
              <GenericPage
                title="Containers"
                description="Group items inside boxes, shelves, and other containers."
                endpoint="/inventory/containers"
              />
            }
          />
          <Route
            path="/documents"
            element={
              <Documents />
            }
          />
          <Route
            path="/warranties"
            element={
              <GenericPage title="Warranties" description="Stay ahead of the dates that matter." />
            }
          />
          <Route
            path="/reports"
            element={
              <GenericPage
                title="Reports"
                description="Create a clear property record for insurance, moving, and peace of mind."
              />
            }
          />
          <Route path="/search" element={<Inventory />} />
          <Route
            path="/notifications"
            element={
              <GenericPage
                title="Notifications"
                description="Important reminders from your ownership records."
              />
            }
          />
          <Route
            path="/settings"
            element={
              <GenericPage
                title="Settings"
                description="Manage your profile, security, and preferences."
              />
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
