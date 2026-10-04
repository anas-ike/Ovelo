import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { get } from '../lib/api';
import { Loading } from '../components/Loading';
export function QrRedirect() {
  const { code } = useParams();
  const query = useQuery({
    queryKey: ['qr', code],
    queryFn: () => get<{ data: { itemId: string } }>(`/qr/${code}`),
    enabled: Boolean(code),
  });
  if (query.isLoading)
    return (
      <div className="app-loading">
        <Loading rows={2} />
      </div>
    );
  return query.data ? (
    <Navigate to={`/item/${query.data.data.itemId}`} replace />
  ) : (
    <div className="app-loading">
      <div className="page-error">This private QR code is invalid or has been revoked.</div>
    </div>
  );
}
