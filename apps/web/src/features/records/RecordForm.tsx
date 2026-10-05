import { useState } from 'react';
import { post, patch } from '../../lib/api';
import type { Warranty, Repair, DocumentRecord } from '../../lib/records';
import { Field, Input, Textarea } from '../../components/Field';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
export function RecordForm({ kind, itemId, currency, record, documents, onClose, onSaved }: { kind: 'warranty' | 'repair'; itemId: string; currency: string; record?: Warranty | Repair; documents: DocumentRecord[]; onClose: () => void; onSaved: () => Promise<unknown> }) {
  const w = kind === 'warranty' ? record as Warranty | undefined : undefined, r = kind === 'repair' ? record as Repair | undefined : undefined;
  const [form, setForm] = useState({ startDate: w?.startDate.slice(0, 10) || '', endDate: w?.endDate.slice(0, 10) || '', provider: w?.provider || r?.repairShop || '', planType: w?.planType || '', warrantyNumber: w?.warrantyNumber || '', coverage: w?.coverage || '', notes: record?.notes || '', date: r?.date.slice(0, 10) || '', problem: r?.problem || '', cost: r?.cost || '0', description: r?.description || '' });
  const [ids, setIds] = useState(record?.documents.map(d => d.documentId) || []), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const change = (key: keyof typeof form, value: string) => setForm(s => ({ ...s, [key]: value }));
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(''); try {
    const body = kind === 'warranty' ? { startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString(), provider: form.provider, planType: form.planType, warrantyNumber: form.warrantyNumber, coverage: form.coverage, notes: form.notes, documentIds: ids } : { date: new Date(form.date).toISOString(), problem: form.problem, repairShop: form.provider, cost: Number(form.cost), currency, description: form.description, notes: form.notes, documentIds: ids };
    const url = `/items/${itemId}/${kind === 'warranty' ? 'warranties' : 'repairs'}`;
    if (record) await patch(`${url}/${record.id}`, body); else await post(url, body);
    await onSaved(); onClose();
  } catch (e) { setError(e instanceof Error ? e.message : 'Record could not be saved.'); } finally { setBusy(false); } }
  return <Modal title={`${record ? 'Edit' : 'Add'} ${kind}`} onClose={onClose}><form className="records-stack" onSubmit={submit}>{error && <p className="form-alert" role="alert">{error}</p>}
    {kind === 'warranty' ? <><div className="form-grid-2"><Field label="Start date"><Input type="date" required value={form.startDate} onChange={e => change('startDate', e.target.value)} /></Field><Field label="Expiry date"><Input type="date" required min={form.startDate} value={form.endDate} onChange={e => change('endDate', e.target.value)} /></Field></div><Field label="Plan / type"><Input value={form.planType} onChange={e => change('planType', e.target.value)} /></Field><Field label="Policy / contract number"><Input value={form.warrantyNumber} onChange={e => change('warrantyNumber', e.target.value)} /></Field><Field label="Coverage details"><Textarea value={form.coverage} onChange={e => change('coverage', e.target.value)} /></Field></> : <><Field label="Repair date"><Input type="date" required value={form.date} onChange={e => change('date', e.target.value)} /></Field><Field label="Repair title"><Input required value={form.problem} onChange={e => change('problem', e.target.value)} /></Field><Field label={`Cost (${currency})`}><Input type="number" min="0" step="0.001" required value={form.cost} onChange={e => change('cost', e.target.value)} /></Field><Field label="Description"><Textarea value={form.description} onChange={e => change('description', e.target.value)} /></Field></>}
    <Field label={kind === 'warranty' ? 'Warranty provider' : 'Provider / technician'}><Input value={form.provider} onChange={e => change('provider', e.target.value)} /></Field><Field label="Notes"><Textarea value={form.notes} onChange={e => change('notes', e.target.value)} /></Field>
    <fieldset><legend>Attach existing item documents</legend>{documents.length ? documents.map(d => <label className="check-row" key={d.id}><input type="checkbox" checked={ids.includes(d.id)} onChange={e => setIds(e.target.checked ? [...ids, d.id] : ids.filter(id => id !== d.id))} />{d.title}</label>) : <p>Upload supporting files in Documents first.</p>}</fieldset>
    <div className="form-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save {kind}</Button></div>
  </form></Modal>;
}
