import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet } from 'react-router-dom';
import { get } from '../lib/api';
import { Loading } from '../components/Loading';
export function AdminProtectedRoute() {
  const q = useQuery({ queryKey: ['admin-me'], queryFn: () => get<{ data: { role: string } }>('/admin/me'), retry: false, staleTime: 0 });
  if (q.isPending) return <div className="app-loading"><Loading rows={3} /></div>;
  if (q.error || !['OWNER', 'ADMIN'].includes(q.data?.data.role || '')) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
