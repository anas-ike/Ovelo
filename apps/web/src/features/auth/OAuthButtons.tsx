import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiBase, get, post } from '../../lib/api';
import { useAuth } from './AuthProvider';

export function OAuthButtons() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);
  const providers = useQuery({ queryKey: ['oauth-providers'], queryFn: () => get<{ data: { google: boolean; discord: boolean } }>('/auth/providers'), staleTime: 60000 });
  async function link(provider: string) {
    setLinking(true); setError('');
    try { const result = await post<{ data: { url: string } }>(`/auth/${provider}/link`); window.location.assign(result.data.url); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not connect this provider.'); setLinking(false); }
  }
  return <section className="oauth-options" aria-label="Provider sign-in">
    <div className="auth-divider"><span>or</span></div>
    {(['google','discord'] as const).map((provider) => {
      const label = provider === 'google' ? 'Google' : 'Discord';
      const enabled = providers.data?.data[provider];
      const content = <><span aria-hidden="true" className={`provider-mark ${provider}`}>{label[0]}</span>{user ? 'Connect' : 'Continue with'} {label}</>;
      return enabled && !user ? <a key={provider} className="oauth-button" href={`${apiBase}/auth/${provider}`}>{content}</a> :
        <button type="button" key={provider} className="oauth-button" disabled={!enabled || linking} onClick={() => void link(provider)} title={providers.isPending ? 'Checking provider availability' : !enabled ? `${label} is not configured` : undefined}>{content}</button>;
    })}
    {providers.error && <p role="alert" className="field-error">Sign-in providers are temporarily unavailable. <button type="button" className="text-button" onClick={() => void providers.refetch()}>Retry</button></p>}
    {error && <p role="alert" className="field-error">{error}</p>}
  </section>;
}
