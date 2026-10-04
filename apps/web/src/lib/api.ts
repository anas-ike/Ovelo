export const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
type ApiOptions = RequestInit & { json?: unknown };
function csrfToken() {
  return document.cookie
    .split('; ')
    .find((part) => part.startsWith('ovelo_csrf='))
    ?.split('=')[1];
}
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.json !== undefined) {
    headers.set('content-type', 'application/json');
    options.body = JSON.stringify(options.json);
  }
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
    const token = csrfToken();
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
