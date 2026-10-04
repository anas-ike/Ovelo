import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { Loading } from '../components/Loading';
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="app-loading">
        <Loading rows={3} />
      </div>
    );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  );
}
