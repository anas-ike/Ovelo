import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import type { ItemSummary } from '@ovelo/types';
import { get } from '../lib/api';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Badge } from '../components/Badge';
type Page = { data: ItemSummary[]; total: number; page: number; pageSize: number };
export function Inventory() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const query = useQuery({
    queryKey: ['items', Object.fromEntries(params)],
    queryFn: () =>
      get<{ data: Page }>(
        `/items?${new URLSearchParams({ q, page: params.get('page') || '1', pageSize: '24', ...(params.get('sort') ? { sort: params.get('sort')! } : {}) })}`,
      ),
  });
  const data = query.data?.data;
  return (
    <div className="inventory-page">
      <div className="inventory-toolbar">
        <div>
          <span className="eyebrow">YOUR THINGS</span>
          <h2>
            Inventory <span>{data?.total ?? '—'}</span>
          </h2>
        </div>
        <Button onClick={() => window.location.assign('/add-item')}>
          <Plus size={17} /> Add item
        </Button>
      </div>
      <div className="search-row">
        <div className="search-box">
          <Search size={17} />
          <input
            value={q}
            onChange={(event) => {
              const value = event.target.value;
              setParams(value ? { q: value } : {});
            }}
            placeholder="Search name, serial, location…"
            aria-label="Search inventory"
          />
        </div>
        <button className="filter-button">
          <SlidersHorizontal size={16} /> Filters
        </button>
        <select
          className="sort-select"
          value={params.get('sort') || 'newest'}
          onChange={(e) => setParams({ q, sort: e.target.value })}
        >
          <option value="newest">Newest first</option>
          <option value="updated">Recently updated</option>
          <option value="name">Name A–Z</option>
          <option value="price">Highest value</option>
        </select>
      </div>
      {query.isLoading ? (
        <Loading rows={6} />
      ) : query.error ? (
        <div className="page-error">Could not load inventory.</div>
      ) : !data?.data.length ? (
        <EmptyState
          title={q ? 'Nothing matched that search' : 'Your inventory is empty'}
          description={
            q
              ? 'Try a different name, serial number, or location.'
              : 'Add the first thing you own and start building your record.'
          }
          action={
            !q && (
              <Link className="button button-primary" to="/add-item">
                <Plus size={16} /> Add your first item
              </Link>
            )
          }
        />
      ) : (
        <div className="item-grid">
          {data.data.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
function ItemCard({ item }: { item: ItemSummary }) {
  const warranty = item.warranties[0];
  const days = warranty
    ? Math.ceil((new Date(warranty.endDate).getTime() - Date.now()) / 86400000)
    : 0;
  return (
    <Link className="item-card" to={`/item/${item.id}`}>
      <div className="item-card-art">
        <span>{item.name.slice(0, 1).toUpperCase()}</span>
        <Badge tone={item.status === 'SOLD' ? 'neutral' : 'green'}>
          {item.status.toLowerCase()}
        </Badge>
      </div>
      <div className="item-card-body">
        <div>
          <h3>{item.name}</h3>
          <span>{item.manufacturer || item.category?.name || 'Uncategorized'}</span>
        </div>
        <strong>
          {item.purchasePrice ? `${item.purchasePrice} ${item.currency}` : 'No value'}
        </strong>
      </div>
      <div className="item-card-foot">
        <span>
          {item.location?.name || 'No location'} · {item.inventoryCode}
        </span>
        {warranty && days > 0 && days <= 90 && (
          <span className="warranty-warning">
            <Filter size={12} /> {days}d warranty
          </span>
        )}
      </div>
    </Link>
  );
}
