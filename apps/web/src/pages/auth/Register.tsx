import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { get, post } from '../../lib/api';
import { OAuthButtons } from '../../features/auth/OAuthButtons';
import { useQuery } from '@tanstack/react-query';
import { policyVersions } from '@ovelo/validation';
export function Register() {
  const navigate = useNavigate();
  const pending = useQuery({
    queryKey: ['oauth-pending'],
    queryFn: () =>
      get<{ data: { provider: string | null; email?: string; name?: string; kind: 'register' | 'consent' | null } }>(
        '/auth/oauth/pending',
      ),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const completing = pending.data?.data.kind === 'register';
  useEffect(() => {
    if (pending.data?.data.email) setEmail(pending.data.data.email);
    if (pending.data?.data.name) setName(pending.data.data.name);
  }, [pending.data]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!consent)
        throw new Error(
          'Accept the Terms of Service and acknowledge the Privacy Policy to continue.',
        );
      const result = await post<{ data: { authenticated?: boolean } }>(
        completing ? '/auth/oauth/register' : '/auth/register',
        {
          name,
          email,
          ...(completing ? {} : { password }),
          termsVersion: policyVersions.terms,
          privacyVersion: policyVersions.privacy,
        },
      );
      if (result.data.authenticated) {
        navigate('/auth/complete', { replace: true });
        return;
      }
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };
  if (pending.isPending) return <AuthShell title="Preparing your account" subtitle="Checking your sign-in request…" />;
  if (pending.data?.data.kind === 'consent') return <Navigate to="/consent?source=oauth" replace />;
  if (pending.error) return <AuthShell title="Sign-in request expired" subtitle="Start provider sign-in again."><p role="alert" className="form-alert">{pending.error.message}</p><OAuthButtons /></AuthShell>;
  return (
    <AuthShell
      title={completing ? 'Finish provider sign-in' : 'Make it yours'}
      subtitle={completing ? 'No password is required. Add your email to finish setting up your account.' : 'Create a private record of everything you own.'}
    >
      {completing &&
        (pending.error ? (
          <p role="alert" className="form-alert">
            Provider sign-in expired. Start sign-in again.
          </p>
        ) : (
          <p className="auth-subtitle">
            {pending.data?.data.email ? 'Your provider verified your email. Accept the policies to create your account and sign in without a password.' : 'Discord verified your identity but did not provide a verified email. Add and verify your email, then continue with Discord. No password is required.'}
          </p>
        ))}
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        {(
          <Field label="Your name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              placeholder="How should we call you?"
            />
          </Field>
        )}
        {(
          <Field label="Email">
            <Input
              type="email"
              readOnly={!!pending.data?.data.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </Field>
        )}
        {!completing && (
          <Field label="Password" hint="At least 12 characters">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
              placeholder="Create a strong password"
            />
          </Field>
        )}
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />{' '}
          <span>
            I agree to the Ovelo{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <Button type="submit" loading={loading} className="full-button">
          {completing ? 'Continue without a password' : 'Create my Ovelo'} <span>→</span>
        </Button>
      </form>
      <OAuthButtons />
      <p className="auth-bottom">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
