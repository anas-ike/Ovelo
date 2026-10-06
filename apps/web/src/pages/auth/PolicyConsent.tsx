import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { policyVersions } from '@ovelo/validation';
import { AuthShell } from './AuthShell';
import { Button } from '../../components/Button';
import { get, post } from '../../lib/api';
import { useAuth } from '../../features/auth/AuthProvider';

export function PolicyConsent() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const source = params.get('source') === 'oauth' ? 'oauth' : 'login';
  const pending = useQuery({
    queryKey: ['consent-pending', source],
    queryFn: () => get<{ data: { kind: 'oauth' | 'login' | null; provider?: string } }>('/auth/consent/pending'),
    retry: false,
  });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await post(source === 'oauth' ? '/auth/oauth/consent' : '/auth/consent', {
        termsVersion: policyVersions.terms,
        privacyVersion: policyVersions.privacy,
      });
      await refresh();
      const next = params.get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to record policy acceptance.');
    } finally {
      setBusy(false);
    }
  };
  const expired = pending.error || !!pending.data && pending.data.data.kind !== source;
  if (pending.isPending) return <AuthShell title="Review Ovelo policies" subtitle="Checking your sign-in request…" />;
  return <AuthShell title="Review Ovelo policies" subtitle={source === 'oauth' ? 'Finish signing in to your existing account.' : 'Finish signing in after reviewing the current policies.'}>
    {expired ? <p className="form-alert" role="alert">This sign-in consent request expired. Start sign-in again.</p> : <form className="auth-form" onSubmit={submit}>
      <p className="auth-subtitle">{source === 'oauth' ? `${pending.data?.data.provider === 'discord' ? 'Discord' : 'Google'} identified your existing Ovelo account.` : 'Your credentials were verified. Accept the current policies to create the authenticated session.'}</p>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <label className="consent-row"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} required /> <span>I agree to the Ovelo <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms &amp; Conditions</Link> and <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link>.</span></label>
      <Button type="submit" loading={busy} className="full-button">Accept and continue</Button>
    </form>}
    <p className="auth-bottom"><Link to="/login">Return to sign in</Link></p>
  </AuthShell>;
}
