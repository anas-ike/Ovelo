import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Clock3,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { get } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Badge } from '../components/Badge';
type DashboardData = {
  stats: {
    itemCount: number;
    purchaseValue: string;
    estimatedValue: string;
    warrantiesExpiring: number;
    repairsThisYear: number;
    repairsCostThisYear: string;
  };
  warranties: {
    id: string;
    endDate: string;
    provider: string | null;
    item: { id: string; name: string; inventoryCode: string };
  }[];
  recent: {
    id: string;
    action: string;
    description: string;
    createdAt: string;
    item: { id: string; name: string } | null;
  }[];
  expensive: {
    id: string;
    name: string;
    inventoryCode: string;
    purchasePrice: string | null;
    currency: string;
  }[];
  storage: { usedBytes: string; reservedBytes: string; limitBytes: string };
};
const money = (value: string, currency = 'KWD') =>
  new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    Number(value),
  );
const date = (value: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(new Date(value));
export function Dashboard() {
  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => get<{ data: DashboardData }>('/items/dashboard'),
  });
  if (query.isLoading) return <Loading rows={7} />;
  if (query.error)
    return <div className="page-error">Could not load your inventory. Refresh and try again.</div>;
  const data = query.data!.data;
  const empty = data.stats.itemCount === 0;
  const storagePercent = Math.min(
    100,
    (Number(data.storage.usedBytes) / Math.max(1, Number(data.storage.limitBytes))) * 100,
  );
  return (
    <div className="dashboard">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
              .format(new Date())
              .toUpperCase()}
          </span>
          <h2>{empty ? 'Make your inventory yours.' : 'Good to see you again.'}</h2>
          <p>
            {empty
              ? 'Add one item, then attach its receipts and warranty details.'
              : 'Here is the latest picture of everything you own.'}
          </p>
        </div>
        <Link className="button button-primary" to="/add-item">
          <Plus size={17} /> Add item
        </Link>
      </div>
      {empty ? (
        <div className="onboarding-card">
          <div className="onboarding-copy">
            <h3>What do you own?</h3>
            <p>
              Capture the essentials first — name, value, and where it lives. Add receipts,
              warranties, and repairs whenever you are ready.
            </p>
            <Link className="button button-primary" to="/add-item">
              Add your first item <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              label="Items in your inventory"
              value={data.stats.itemCount.toString()}
              icon={<Package size={18} />}
            />
            <Metric
              label="Purchase value"
              value={money(data.stats.purchaseValue)}
              icon={<ReceiptText size={18} />}
            />
            <Metric
              label="Estimated current value"
              value={money(data.stats.estimatedValue)}
              icon={<Sparkles size={18} />}
            />
            <Metric
              label="Warranty expiring soon"
              value={data.stats.warrantiesExpiring.toString()}
              icon={<ShieldCheck size={18} />}
              tone={data.stats.warrantiesExpiring ? 'amber' : undefined}
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel activity-panel">
              <div className="panel-head">
                <div>
                  <h3>Recent activity</h3>
                </div>
                <Link className="subtle-link" to="/activity">
                  View all <ArrowUpRight size={14} />
                </Link>
              </div>
              {data.recent.length ? (
                <div className="activity-list">
                  {data.recent.map((activity) => (
                    <div className="activity-row" key={activity.id}>
                      <span className="activity-icon">
                        <Clock3 size={15} />
                      </span>
                      <div>
                        <strong>{activity.description}</strong>
                        <span>
                          {activity.item?.name || 'Inventory'} · {date(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Your history starts here"
                  description="Changes to your inventory will appear in this timeline."
                />
              )}
            </section>
            <section className="panel warranty-panel">
              <div className="panel-head">
                <div>
                  <h3>Warranty alerts</h3>
                </div>
                <Link className="subtle-link" to="/warranties">
                  View all <ArrowUpRight size={14} />
                </Link>
              </div>
              {data.warranties.length ? (
                <div className="warranty-list">
                  {data.warranties.map((warranty) => (
                    <Link
                      className="warranty-row"
                      to={`/item/${warranty.item.id}`}
                      key={warranty.id}
                    >
                      <span className="warranty-mark">
                        <ShieldCheck size={16} />
                      </span>
                      <div>
                        <strong>{warranty.item.name}</strong>
                        <span>
                          {warranty.provider || 'Warranty'} · ends {date(warranty.endDate)}
                        </span>
                      </div>
                      <Badge tone="amber">
                        {Math.max(
                          0,
                          Math.ceil((new Date(warranty.endDate).getTime() - Date.now()) / 86400000),
                        )}{' '}
                        days
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="quiet-state">
                  <ShieldCheck size={22} />
                  <p>No warranties expiring in the next 90 days.</p>
                </div>
              )}
            </section>
            <section className="panel expensive-panel">
              <div className="panel-head">
                <div>
                  <h3>Most expensive</h3>
                </div>
                <Link className="subtle-link" to="/inventory?sort=price">
                  Inventory <ArrowUpRight size={14} />
                </Link>
              </div>
              <div className="value-list">
                {data.expensive.map((item, index) => (
                  <Link className="value-row" to={`/item/${item.id}`} key={item.id}>
                    <span className="rank">0{index + 1}</span>
                    <span>
                      {item.name}
                      <small>{item.inventoryCode}</small>
                    </span>
                    <strong>
                      {item.purchasePrice ? money(item.purchasePrice, item.currency) : '—'}
                    </strong>
                  </Link>
                ))}
              </div>
            </section>
            <section className="panel storage-panel">
              <div className="panel-head">
                <div>
                  <h3>Space used</h3>
                </div>
                <span className="storage-number">{Math.round(storagePercent)}%</span>
              </div>
              <div className="progress">
                <span style={{ width: `${storagePercent}%` }} />
              </div>
              <p>
                {formatBytes(Number(data.storage.usedBytes))} of{' '}
                {formatBytes(Number(data.storage.limitBytes))} used
              </p>
              <Link className="subtle-link" to="/settings">
                Manage storage <ArrowUpRight size={14} />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'amber';
}) {
  return (
    <div className={`metric ${tone ? 'metric-amber' : ''}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}
function formatBytes(value: number) {
  if (!value) return '0 MB';
  if (value > 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(value / 1024 ** 2)} MB`;
}
