export type ItemStatus = 'OWNED' | 'LISTED' | 'SOLD' | 'LOST' | 'STOLEN' | 'DISPOSED' | 'ARCHIVED';
export interface ApiError {
  error: { code: string; message: string; requestId?: string };
}
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'OWNER';
  emailVerifiedAt: string | null;
  hasAvatar?: boolean;
}
export interface ItemSummary {
  id: string;
  inventoryCode: string;
  name: string;
  description: string | null;
  status: ItemStatus;
  purchasePrice: string | null;
  estimatedValue: string | null;
  currency: string;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  store: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; icon: string } | null;
  location: { id: string; name: string } | null;
  container: { id: string; name: string } | null;
  warranties: { id: string; endDate: string; provider: string | null }[];
  _count: { documents: number; repairs: number };
}
