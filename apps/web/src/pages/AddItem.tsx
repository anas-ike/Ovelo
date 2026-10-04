import { useEffect, useState } from 'react';
import { ArrowLeft, FileUp, Plus, Save } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field, Input, Textarea } from '../components/Field';
import { get, post } from '../lib/api';
type Option = { id: string; name: string; icon?: string };
export function AddItem() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Option[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [form, setForm] = useState({
    name: '',
    manufacturer: '',
    modelNumber: '',
    serialNumber: '',
    purchasePrice: '',
    currency: 'KWD',
    purchaseDate: '',
    store: '',
    categoryId: '',
    locationId: '',
    notes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    void Promise.all([
      get<{ data: Option[] }>('/inventory/categories'),
      get<{ data: Option[] }>('/inventory/locations'),
    ]).then(([cats, locs]) => {
      setCategories(cats.data);
      setLocations(locs.data);
    });
  }, []);
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await post<{ data: { id: string } }>('/items', {
        ...form,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate).toISOString() : null,
        categoryId: form.categoryId || null,
        locationId: form.locationId || null,
      });
      navigate(`/item/${result.data.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this item.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="form-page">
      <Link className="back-link" to="/inventory">
        <ArrowLeft size={15} /> Back to inventory
      </Link>
      <div className="form-page-head">
        <div>
          <span className="eyebrow">NEW OWNERSHIP RECORD</span>
          <h2>Add an item</h2>
          <p>Start with the details you know. Everything can be refined later.</p>
        </div>
        <div className="form-page-icon">
          <Plus size={24} />
        </div>
      </div>
      <form className="item-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        <section className="form-section">
          <div className="form-section-title">
            <span>01</span>
            <div>
              <h3>The essentials</h3>
              <p>Give this thing a name you will recognize.</p>
            </div>
          </div>
          <div className="form-fields">
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. MacBook Pro 14-inch"
                required
              />
            </Field>
            <div className="form-grid-2">
              <Field label="Manufacturer">
                <Input
                  value={form.manufacturer}
                  onChange={(e) => update('manufacturer', e.target.value)}
                  placeholder="Apple"
                />
              </Field>
              <Field label="Model">
                <Input
                  value={form.modelNumber}
                  onChange={(e) => update('modelNumber', e.target.value)}
                  placeholder="A2442"
                />
              </Field>
            </div>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-title">
            <span>02</span>
            <div>
              <h3>Context</h3>
              <p>Useful clues for finding and understanding it later.</p>
            </div>
          </div>
          <div className="form-fields">
            <div className="form-grid-2">
              <Field label="Category">
                <select
                  className="input"
                  value={form.categoryId}
                  onChange={(e) => update('categoryId', e.target.value)}
                >
                  <option value="">Choose a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <select
                  className="input"
                  value={form.locationId}
                  onChange={(e) => update('locationId', e.target.value)}
                >
                  <option value="">Choose a location</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="form-grid-2">
              <Field label="Serial number">
                <Input
                  value={form.serialNumber}
                  onChange={(e) => update('serialNumber', e.target.value)}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Store">
                <Input
                  value={form.store}
                  onChange={(e) => update('store', e.target.value)}
                  placeholder="Where did you get it?"
                />
              </Field>
            </div>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section-title">
            <span>03</span>
            <div>
              <h3>Value & history</h3>
              <p>These fields help Ovelo tell the full ownership story.</p>
            </div>
          </div>
          <div className="form-fields">
            <div className="form-grid-3">
              <Field label="Purchase price">
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.purchasePrice}
                  onChange={(e) => update('purchasePrice', e.target.value)}
                  placeholder="0.000"
                />
              </Field>
              <Field label="Currency">
                <select
                  className="input"
                  value={form.currency}
                  onChange={(e) => update('currency', e.target.value)}
                >
                  <option>KWD</option>
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>SAR</option>
                </select>
              </Field>
              <Field label="Purchase date">
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => update('purchaseDate', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="Anything worth remembering…"
                rows={4}
              />
            </Field>
          </div>
        </section>
        <section className="attach-callout">
          <div className="attach-icon">
            <FileUp size={20} />
          </div>
          <div>
            <strong>Attach supporting records later</strong>
            <p>Receipts, warranty documents, photos, and manuals live with this item.</p>
          </div>
        </section>
        <div className="form-actions">
          <Link className="button button-ghost" to="/inventory">
            Cancel
          </Link>
          <Button loading={loading} type="submit">
            <Save size={16} /> Save ownership record
          </Button>
        </div>
      </form>
    </div>
  );
}
