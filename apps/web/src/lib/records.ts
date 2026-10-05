export type DocumentRecord = { id: string; kind: string; title: string; createdAt: string; item: { id: string; name: string }; storageObject: { filename: string; mimeType: string; size: string } };
export type Place = { id?: string; name: string; address?: string | null; latitude?: number | null; longitude?: number | null; mapsUrl?: string | null };
export type Warranty = { id: string; startDate: string; endDate: string; provider: string | null; warrantyNumber: string | null; planType: string | null; coverage: string | null; notes: string | null; documents: { documentId: string }[] };
export type Repair = { id: string; date: string; problem: string; repairShop: string | null; cost: string; currency: string; description: string | null; notes: string | null; documents: { documentId: string }[] };
export const documentKinds = ['RECEIPT', 'WARRANTY', 'MANUAL', 'REPAIR', 'INSURANCE', 'PURCHASE', 'OTHER'];
export const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not recorded';
export const warrantyStatus = (w: Warranty) => new Date(w.endDate).getTime() < Date.now() ? 'Expired' : new Date(w.startDate).getTime() > Date.now() ? 'Not started' : new Date(w.endDate).getTime() - Date.now() < 90 * 86400000 ? 'Expiring soon' : 'Active';
