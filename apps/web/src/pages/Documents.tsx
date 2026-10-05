import { useQuery } from '@tanstack/react-query';
import { get } from '../lib/api';
import type { DocumentRecord } from '../lib/records';
import { DocumentList } from '../features/records/DocumentList';
import { Loading } from '../components/Loading';
export function Documents() { const q = useQuery({ queryKey: ['documents', 'all'], queryFn: () => get<{ data: DocumentRecord[] }>('/documents') }); return <div><div className="form-page-head"><div><h2>Documents</h2><p>Supporting records across your items. Add files from an item’s Documents tab.</p></div></div>{q.isPending ? <Loading rows={4} /> : q.error ? <p className="form-alert" role="alert">Could not load documents. <button onClick={() => void q.refetch()}>Retry</button></p> : <DocumentList documents={q.data.data} onChange={() => q.refetch()} />}</div>; }
