import { useState } from 'react';
import { Link } from 'react-router-dom';
import { del, downloadFile, fileBlob, upload } from '../../lib/api';
import { displayDate, documentKinds } from '../../lib/records';
import type { DocumentRecord } from '../../lib/records';
import { Button } from '../../components/Button';
import { Field, Input } from '../../components/Field';
import { Modal } from '../../components/Modal';

export function DocumentList({ documents, itemId, onChange }: { documents: DocumentRecord[]; itemId?: string; onChange: () => Promise<unknown> }) {
  const [kind, setKind] = useState('OTHER'), [title, setTitle] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const [preview, setPreview] = useState<{ url: string; title: string }>();
  async function perform(action: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await action(); await onChange(); setMessage(success); } catch (e) { setError(e instanceof Error ? e.message : 'Document action failed.'); } finally { setBusy(false); }
  }
  function closePreview() { if (preview) URL.revokeObjectURL(preview.url); setPreview(undefined); }
  return <div className="records-stack">
    {itemId && <div className="record-upload"><Field label="Document type"><select className="input" value={kind} onChange={e => setKind(e.target.value)}>{documentKinds.map(k => <option key={k}>{k}</option>)}</select></Field><Field label="Title (optional)"><Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} /></Field><Field label={busy ? 'Uploading…' : 'Upload document'} hint="JPG, PNG, WEBP, PDF. PDFs require the configured malware scanner."><Input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; const data = new FormData(); data.append('file', file); data.append('kind', kind); data.append('title', title || file.name); void perform(() => upload(`/items/${itemId}/documents`, data), 'Document uploaded.'); }} /></Field></div>}
    {error && <p role="alert" className="form-alert">{error}</p>}{message && <p role="status" className="success-note">{message}</p>}
    {!documents.length && <p className="inline-empty">No documents yet. Add a receipt, warranty, or manual.</p>}
    {documents.map(d => <article className="record-card" key={d.id}><div><h3>{d.title}</h3><p>{d.kind} · {displayDate(d.createdAt)} · {(Number(d.storageObject.size) / 1024).toFixed(1)} KB</p>{!itemId && <Link to={`/item/${d.item.id}?tab=documents`}>{d.item.name}</Link>}<small>{d.storageObject.filename}</small></div><div className="record-actions">{d.storageObject.mimeType.startsWith('image/') && <Button variant="ghost" disabled={busy} onClick={() => void perform(async () => setPreview({ url: URL.createObjectURL(await fileBlob(`/documents/${d.id}/download?preview=true`)), title: d.title }), '')}>View</Button>}<Button variant="ghost" disabled={busy} onClick={() => void perform(() => downloadFile(`/documents/${d.id}/download`, d.storageObject.filename), 'Download ready.')}>Download</Button><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Delete “${d.title}”? This removes the attached file.`)) void perform(() => del(`/documents/${d.id}`), 'Document deleted.'); }}>Delete</Button></div></article>)}
    {preview && <Modal title={preview.title} onClose={closePreview}><img className="document-preview" src={preview.url} alt={preview.title} /></Modal>}
  </div>;
}
