import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  ShieldCheck,
  Tag,
  Wrench,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { get, upload } from '../lib/api';
import { Loading } from '../components/Loading';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { useRef, useState } from 'react';
type Detail = {
  id: string;
  inventoryCode: string;
  name: string;
  description: string | null;
  status: string;
  purchaseDate: string | null;
  purchasePrice: string | null;
  estimatedValue: string | null;
  currency: string;
  store: string | null;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; icon: string } | null;
  location: { id: string; name: string } | null;
  container: { id: string; name: string } | null;
  warranties: {
    id: string;
    startDate: string;
    endDate: string;
    provider: string | null;
    warrantyNumber: string | null;
  }[];
  _count: { documents: number; repairs: number };
};
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—';
export function ItemDetail() {
  const { id } = useParams();
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const query = useQuery({
    queryKey: ['item', id],
    queryFn: () => get<{ data: Detail }>(`/items/${id}`),
    enabled: Boolean(id),
  });
  if (query.isLoading) return <Loading rows={8} />;
  if (query.error || !query.data)
    return <div className="page-error">This item could not be found.</div>;
  const item = query.data.data;
  const warranty = item.warranties[0];
  const days = warranty
    ? Math.ceil((new Date(warranty.endDate).getTime() - Date.now()) / 86400000)
    : null;
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;
    const form = new FormData();
    form.append('file', file);
    form.append('kind', 'OTHER');
    form.append('title', file.name);
    setUploading(true);
    try {
      await upload(`/items/${id}/documents`, form);
      await client.invalidateQueries({ queryKey: ['item', id] });
    } catch {
      /* surfaced through the next refresh */
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };
  return (
    <div className="detail-page">
      <Link className="back-link" to="/inventory">
        <ArrowLeft size={15} /> Back to inventory
      </Link>
      <div className="detail-hero">
        <div className="detail-art">
          <span>{item.name.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="detail-title">
          <div className="detail-title-row">
            <Badge tone={item.status === 'OWNED' ? 'green' : 'neutral'}>
              {item.status.toLowerCase()}
            </Badge>
            <span className="detail-id">{item.inventoryCode}</span>
          </div>
          <h2>{item.name}</h2>
          <p>
            {[item.manufacturer, item.modelNumber, item.category?.name]
              .filter(Boolean)
              .join(' · ') || 'Uncategorized item'}
          </p>
        </div>
        <div className="detail-actions">
          <Button variant="ghost">
            <Pencil size={16} /> Edit
          </Button>
          <button className="icon-button">
            <MoreHorizontal size={19} />
          </button>
        </div>
      </div>
      <div className="detail-grid">
        <section className="detail-main">
          <div className="detail-tabs">
            <button className="active">Overview</button>
            <button>
              Documents <span>{item._count.documents}</span>
            </button>
            <button>Warranty {warranty && <span>1</span>}</button>
            <button>
              Repairs <span>{item._count.repairs}</span>
            </button>
            <button>Activity</button>
          </div>
          <div className="detail-sections">
            <section className="detail-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">THE BASICS</span>
                  <h3>Ownership details</h3>
                </div>
                <Tag size={18} />
              </div>
              <div className="detail-facts">
                <Fact
                  label="Purchase"
                  value={
                    item.purchasePrice ? `${item.purchasePrice} ${item.currency}` : 'Not recorded'
                  }
                  sub={date(item.purchaseDate)}
                />
                <Fact
                  label="Current value"
                  value={
                    item.estimatedValue
                      ? `${item.estimatedValue} ${item.currency}`
                      : 'Not estimated'
                  }
                  sub="User-entered estimate"
                />
                <Fact
                  label="Location"
                  value={item.location?.name || 'No location'}
                  sub={item.container?.name || undefined}
                />
                <Fact label="Serial number" value={item.serialNumber || 'Not recorded'} />
              </div>
            </section>
            <section className="detail-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">SUPPORTING RECORDS</span>
                  <h3>Documents</h3>
                </div>
                <button
                  className="section-action"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    'Uploading…'
                  ) : (
                    <>
                      <Plus size={15} /> Add
                    </>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleUpload}
                />
              </div>
              {item._count.documents ? (
                <div className="record-placeholder">
                  <FileText size={18} />
                  <span>
                    {item._count.documents} attached record{item._count.documents === 1 ? '' : 's'}
                  </span>
                  <Download size={15} />
                </div>
              ) : (
                <div className="inline-empty">
                  <FileText size={18} />
                  <span>No documents yet. Add a receipt, warranty, or manual.</span>
                </div>
              )}
            </section>
            <section className="detail-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">COVERAGE</span>
                  <h3>Warranty</h3>
                </div>
                <ShieldCheck size={18} />
              </div>
              {warranty ? (
                <div className="warranty-detail">
                  <div className="warranty-detail-icon">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <strong>{warranty.provider || 'Warranty coverage'}</strong>
                    <span>
                      {date(warranty.startDate)} — {date(warranty.endDate)}
                    </span>
                  </div>
                  <Badge tone={days !== null && days <= 90 ? 'amber' : 'green'}>
                    {days && days > 0 ? `${days} days left` : 'Expired'}
                  </Badge>
                </div>
              ) : (
                <div className="inline-empty">
                  <ShieldCheck size={18} />
                  <span>No warranty details attached yet.</span>
                  <button className="text-button">Add warranty</button>
                </div>
              )}
            </section>
            <section className="detail-section">
              <div className="section-head">
                <div>
                  <span className="eyebrow">MAINTENANCE</span>
                  <h3>Repairs</h3>
                </div>
                <Wrench size={18} />
              </div>
              <div className="inline-empty">
                <Wrench size={18} />
                <span>
                  {item._count.repairs
                    ? `${item._count.repairs} repair records`
                    : 'No repairs recorded.'}
                </span>
                <button className="text-button">Add repair</button>
              </div>
            </section>
          </div>
        </section>
        <aside className="detail-aside">
          <div className="aside-card ownership-card">
            <span className="eyebrow">OWNED SINCE</span>
            <strong>{date(item.createdAt)}</strong>
            <p>Ovelo has kept this record for you.</p>
            <div className="aside-rule" />
            <span className="eyebrow">INVENTORY ID</span>
            <code>{item.inventoryCode}</code>
          </div>
          <div className="aside-card">
            <span className="eyebrow">LAST UPDATED</span>
            <strong>{date(item.updatedAt)}</strong>
            <p>Changes are kept in your activity history.</p>
            <Link className="subtle-link" to="/activity">
              View history <ArrowLeft size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
