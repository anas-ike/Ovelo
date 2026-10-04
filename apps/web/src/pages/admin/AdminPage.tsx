import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Boxes,
  Database,
  FileClock,
  Globe2,
  HardDrive,
  LogOut,
  Search,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../lib/api';
import { Logo } from '../../components/Logo';
import { Loading } from '../../components/Loading';
type Overview = {
  users: number;
  items: number;
  storageUsedBytes: string;
  securityEvents24h: number;
  failedJobs: number;
};
const sections = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'subscriptions', label: 'Subscriptions', icon: Boxes },
  { id: 'domains', label: 'Email domains', icon: Globe2 },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'security', label: 'Security', icon: ShieldAlert },
  { id: 'audit', label: 'Audit logs', icon: FileClock },
  { id: 'jobs', label: 'Background jobs', icon: Database },
  { id: 'settings', label: 'System settings', icon: Settings2 },
];
export function AdminPage() {
  const [section, setSection] = useState('overview');
  const navigate = useNavigate();
  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => get<{ data: Overview }>('/admin/overview'),
  });
  const detail = useQuery({
    queryKey: ['admin-detail', section],
    queryFn: () =>
      get<{ data: unknown }>(
        `/admin/${section === 'users' ? 'users' : section === 'domains' ? 'domains' : section === 'security' ? 'security-events' : section === 'audit' ? 'audit-logs' : 'overview'}`,
      ),
    enabled: section !== 'overview',
  });
  const logout = async () => {
    await post('/auth/logout').catch(() => undefined);
    navigate('/admin/login');
  };
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Logo />
        <span className="admin-label">OPERATIONS</span>
        <nav>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={section === id ? 'active' : ''}
              onClick={() => setSection(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <button className="admin-logout" onClick={() => void logout()}>
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="eyebrow">O VELO / ADMIN</span>
            <h1>{sections.find((item) => item.id === section)?.label}</h1>
          </div>
          <span className="admin-status">
            <i /> System nominal
          </span>
        </header>
        <div className="admin-content">
          {section === 'overview' ? (
            overview.isLoading ? (
              <Loading rows={5} />
            ) : overview.error ? (
              <div className="page-error">Admin session required.</div>
            ) : (
              <>
                <div className="admin-metrics">
                  <AdminMetric
                    label="Accounts"
                    value={overview.data!.data.users.toString()}
                    icon={<Users size={17} />}
                  />
                  <AdminMetric
                    label="Ownership records"
                    value={overview.data!.data.items.toString()}
                    icon={<Boxes size={17} />}
                  />
                  <AdminMetric
                    label="Storage used"
                    value={formatBytes(Number(overview.data!.data.storageUsedBytes))}
                    icon={<HardDrive size={17} />}
                  />
                  <AdminMetric
                    label="Security events / 24h"
                    value={overview.data!.data.securityEvents24h.toString()}
                    icon={<ShieldAlert size={17} />}
                  />
                </div>
                <div className="admin-grid">
                  <div className="admin-card">
                    <span className="eyebrow">SYSTEM NOTES</span>
                    <h2>Keep the private layer private.</h2>
                    <p>
                      Administrator access exposes account metadata, operations, and security
                      telemetry. User documents remain scoped to their ownership records and are not
                      automatically available in this console.
                    </p>
                  </div>
                  <div className="admin-card admin-job-card">
                    <span className="eyebrow">JOB HEALTH</span>
                    <strong>{overview.data!.data.failedJobs}</strong>
                    <p>failed migration jobs require attention</p>
                  </div>
                </div>
              </>
            )
          ) : detail.isLoading ? (
            <Loading rows={5} />
          ) : (
            <div className="admin-card">
              <div className="admin-card-head">
                <div>
                  <span className="eyebrow">LIVE DATA</span>
                  <h2>{sections.find((item) => item.id === section)?.label}</h2>
                </div>
                <Search size={18} />
              </div>
              <pre className="admin-json">{JSON.stringify(detail.data?.data, null, 2)}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
function AdminMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="admin-metric">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
function formatBytes(value: number) {
  return value > 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(1)} GB`
    : `${Math.round(value / 1024 ** 2)} MB`;
}
