import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { Loading } from '../components/Loading';
export function ProtectedRoute() {
  const { user, loading, sessionError, refresh } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="app-loading">
        <Loading rows={3} />
      </div>
    );
  if (sessionError) return (
    <div className="app-loading">
      <div>
        <h1>Unable to confirm your session</h1>
        <p role="alert" className="form-alert">{sessionError}</p>
        <button type="button" className="button" onClick={() => void refresh()}>Retry session check</button>{' '}
        <Link to="/login">Return to sign in</Link>
      </div>
    </div>
  );
  return user ? (
    <Outlet />
  ) : (
    <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  );
}
