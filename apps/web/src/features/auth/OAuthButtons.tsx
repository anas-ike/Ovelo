import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiBase, get, post } from '../../lib/api';
import { useAuth } from './AuthProvider';

export function OAuthButtons({ mode = 'sign-in' }: { mode?: 'sign-in' | 'link' }) {
  const { user } = useAuth();
  const connecting = mode === 'link';
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);
  const providers = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => get<{ data: { google: boolean; discord: boolean } }>('/auth/providers'),
    staleTime: 60000,
  });
  const profile = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => get<{ data: { accounts: { provider: string }[] } }>('/auth/profile'),
    enabled: connecting && Boolean(user),
    staleTime: 30000,
  });
  async function link(provider: string) {
    if (!user || !window.confirm(`Connect ${provider === 'google' ? 'Google' : 'Discord'} to ${user.email}? This will let that provider sign in to this same Ovelo account. To keep the accounts separate, cancel and use Sign out instead.`)) return;
    setLinking(true);
    setError('');
    try {
      const result = await post<{ data: { url: string } }>(`/auth/${provider}/link`, { intent: 'link-account' });
      window.location.assign(result.data.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not connect this provider.');
      setLinking(false);
    }
  }
  return (
    <section className="oauth-options" aria-label="Provider sign-in">
      <div className="auth-divider">
        <span>or</span>
      </div>
      {(['google', 'discord'] as const).map((provider) => {
        const label = provider === 'google' ? 'Google' : 'Discord';
        const enabled = providers.data?.data[provider];
        const connected = profile.data?.data.accounts.some((account) => account.provider === provider);
        const content = (
          <>
            <span aria-hidden="true" className={`provider-mark ${provider}`}>
              {label[0]}
            </span>
            {connecting && connected ? 'Connected' : connecting ? 'Connect' : 'Continue with'} {label}
          </>
        );
        return enabled && !connecting ? (
          <a key={provider} className="oauth-button" href={`${apiBase}/auth/${provider}`}>
            {content}
          </a>
        ) : (
          <button
            type="button"
            key={provider}
            className="oauth-button"
             disabled={!enabled || linking || !connecting || !user || connected}
            onClick={() => void link(provider)}
            title={
              providers.isPending
                ? 'Checking provider availability'
                : !enabled
                  ? `${label} is not configured`
                  : undefined
            }
          >
            {content}
          </button>
        );
      })}
      {providers.error && (
        <p role="alert" className="field-error">
          Sign-in providers are temporarily unavailable.{' '}
          <button type="button" className="text-button" onClick={() => void providers.refetch()}>
            Retry
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
