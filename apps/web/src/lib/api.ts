export const apiBase = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '');
type ApiOptions = RequestInit & { json?: unknown };
async function csrfToken(admin = false) {
  const response = await fetch(`${apiBase}/${admin ? 'admin' : 'auth'}/csrf`, { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) return undefined; // Public registration/login do not yet have a session.
  if (!response.ok) throw new Error('Unable to verify request protection. Please sign in again.');
  const result = await response.json() as { data: { csrfToken: string } };
  return result.data.csrfToken;
}
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    options.body = JSON.stringify(options.json);
  }
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    const token = await csrfToken(path.startsWith('/admin/'));
    if (token) headers.set('x-csrf-token', token);
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => undefined)) as
      { error?: { message?: string; code?: string } } | undefined;
    const error = new Error(payload?.error?.message || 'Something went wrong.');
    Object.assign(error, { code: payload?.error?.code, status: response.status });
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json });
export const patch = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
export const upload = <T>(path: string, form: FormData) =>
  api<T>(path, { method: 'POST', body: form });
export async function fileBlob(path: string) {
  const response = await fetch(`${apiBase}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message || 'The file is not available.');
  }
  return response.blob();
}
export async function downloadFile(path: string, filename: string) {
  const url = URL.createObjectURL(await fileBlob(path));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
