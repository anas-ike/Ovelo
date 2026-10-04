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
import { AdminPage } from './pages/admin/AdminPage';
import { QrRedirect } from './pages/QrRedirect';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { AddItem } from './pages/AddItem';
import { ItemDetail } from './pages/ItemDetail';
import { GenericPage } from './pages/GenericPage';
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/i/:code" element={<QrRedirect />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/add-item" element={<AddItem />} />
          <Route path="/item/:id" element={<ItemDetail />} />
          <Route
            path="/activity"
            element={
              <GenericPage
                title="Activity"
                description="A chronological record of the changes you make to your ownership records."
                endpoint="/activity"
              />
            }
          />
          <Route
            path="/locations"
            element={
              <GenericPage
                title="Locations"
                description="Keep a clear map of where your things live."
                endpoint="/inventory/locations"
              />
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
              <GenericPage
                title="Documents"
                description="Supporting records attached to your ownership records."
              />
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
