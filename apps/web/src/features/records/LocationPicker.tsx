import { useState } from 'react';
import { get, post } from '../../lib/api';
import type { Place } from '../../lib/records';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
export function LocationPicker({ locations, value, onSelect, onCreated }: { locations: Place[]; value: string; onSelect: (id: string) => void; onCreated: (place: Place) => void }) {
  const [query, setQuery] = useState(''), [link, setLink] = useState(''), [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [results, setResults] = useState<Place[]>([]), [parsed, setParsed] = useState<Place>();
  async function action(fn: () => Promise<void>) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Location unavailable.'); } finally { setBusy(false); } }
  async function create(place: Place) { const { id: _id, ...data } = place; void _id; const result = await post<{ data: Place & { id: string } }>('/inventory/locations', { ...data, type: 'OTHER' }); onCreated(result.data); onSelect(result.data.id); setParsed(undefined); setResults([]); }
  return <div className="location-picker"><Field label="Saved location"><select className="input" value={value} onChange={e => onSelect(e.target.value)}><option value="">No location</option>{locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
    <div className="form-grid-2"><div><Field label="Search location" hint="Search saved places or an address. Without a Maps API key, choose a manual address."><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search location…" /></Field><Button type="button" variant="ghost" disabled={busy || query.trim().length < 2} onClick={() => void action(async () => { const r = await get<{ data: { saved: Place[]; places: Place[]; manualAddress?: string } }>(`/inventory/locations/search?q=${encodeURIComponent(query)}`); setResults([...r.data.saved, ...r.data.places, ...(r.data.manualAddress ? [{ name: query.slice(0, 100), address: query, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` }] : [])]); })}>Search</Button></div>
    <div><Field label="Google Maps link"><Input value={link} onChange={e => setLink(e.target.value)} placeholder="Paste Google Maps link" type="url" /></Field><Button type="button" variant="ghost" disabled={busy || !link} onClick={() => void action(async () => { const r = await post<{ data: Place }>('/inventory/locations/parse-maps', { url: link }); setParsed(r.data); setName(r.data.name || ''); })}>Read link</Button></div></div>
    {results.length > 0 && <ul className="location-results">{results.map((p, i) => <li key={p.id || i}><button type="button" disabled={busy} onClick={() => p.id ? onSelect(p.id) : void action(() => create(p))}>{p.name}<small>{p.address}{!p.id && ' · Save this location'}</small></button></li>)}</ul>}
    {parsed && <div className="record-card"><Field label="Place name"><Input value={name} onChange={e => setName(e.target.value)} maxLength={100} required /></Field><p>{parsed.address || 'The sharing link has no address details. Add a recognizable label.'}</p><Button type="button" disabled={busy || !name.trim()} onClick={() => void action(() => create({ ...parsed, name: name.trim() }))}>Use location</Button></div>}
    {error && <p role="alert" className="form-alert">{error}</p>}
  </div>;
}
