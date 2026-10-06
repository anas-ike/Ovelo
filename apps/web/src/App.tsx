import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import { Landing } from './pages/Landing';
import { lazy, Suspense } from 'react';
import { AdminProtectedRoute } from './layouts/AdminProtectedRoute';
import { PublicInfo } from './pages/PublicInfo';
import { SeoHead } from './components/SeoHead';
import { NotFound } from './pages/NotFound';
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/auth/Register').then((m) => ({ default: m.Register })));
const VerifyEmail = lazy(() =>
  import('./pages/auth/VerifyEmail').then((m) => ({ default: m.VerifyEmail })),
);
const ForgotPassword = lazy(() =>
  import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })),
);
const ResetPassword = lazy(() =>
  import('./pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })),
);
const AdminLogin = lazy(() =>
  import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })),
);
const AdminRecovery = lazy(() =>
  import('./pages/admin/AdminRecovery').then((m) => ({ default: m.AdminRecovery })),
);
const QrRedirect = lazy(() =>
  import('./pages/QrRedirect').then((m) => ({ default: m.QrRedirect })),
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Inventory = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })));
const AddItem = lazy(() => import('./pages/AddItem').then((m) => ({ default: m.AddItem })));
const ItemDetail = lazy(() =>
  import('./pages/ItemDetail').then((m) => ({ default: m.ItemDetail })),
);
const GenericPage = lazy(() =>
  import('./pages/GenericPage').then((m) => ({ default: m.GenericPage })),
);
const Documents = lazy(() => import('./pages/Documents').then((m) => ({ default: m.Documents })));
const Locations = lazy(() => import('./pages/Locations').then((m) => ({ default: m.Locations })));
const Scan = lazy(() => import('./pages/Scan').then((m) => ({ default: m.Scan })));
const Activity = lazy(() => import('./pages/Activity').then((m) => ({ default: m.Activity })));
const AdminPage = lazy(() =>
  import('./pages/admin/AdminPage').then((m) => ({ default: m.AdminPage })),
);
export function App() {
  return (
    <>
      <SeoHead />
      <Suspense
        fallback={
          <div className="app-loading">
            <div className="loading-stack" aria-label="Loading page">
              <div className="skeleton" />
            </div>
          </div>
        }
      >
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
          <Route element={<AdminProtectedRoute />}>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<p>Loading administrator page…</p>}>
                  <AdminPage />
                </Suspense>
              }
            />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/i/:code" element={<QrRedirect />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/add-item" element={<AddItem />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route path="/item/:id/edit" element={<AddItem />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/locations" element={<Locations />} />
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
              <Route path="/documents" element={<Documents />} />
              <Route
                path="/warranties"
                element={
                  <GenericPage
                    title="Warranties"
                    description="Stay ahead of the dates that matter."
                  />
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
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
