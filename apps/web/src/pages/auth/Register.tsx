import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { get, post } from '../../lib/api';
import { OAuthButtons } from '../../features/auth/OAuthButtons';
import { useQuery } from '@tanstack/react-query';
import { policyVersions } from '@ovelo/validation';
import { useAuth } from '../../features/auth/AuthProvider';
export function Register() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const completing = params.get('oauth') === 'complete';
  const consenting = params.get('oauth') === 'consent';
  const pending = useQuery({
    queryKey: ['oauth-pending'],
    queryFn: () =>
      get<{ data: { provider: string | null; email?: string; name?: string } }>(
        '/auth/oauth/pending',
      ),
    enabled: completing || consenting,
    retry: false,
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [consent, setConsent] = useState(false);
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
      if (consenting)
        await post('/auth/oauth/consent', {
          termsVersion: policyVersions.terms,
          privacyVersion: policyVersions.privacy,
        });
      else
        await post('/auth/register', {
          name,
          email,
          password,
          termsVersion: policyVersions.terms,
          privacyVersion: policyVersions.privacy,
        });
      if (consenting) {
        await refresh();
        navigate('/dashboard', { replace: true });
        return;
      }
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell
      title={consenting ? 'One last privacy check' : 'Make it yours'}
      subtitle={
        consenting
          ? 'Accept the current policies to finish signing in.'
          : 'Create a private record of everything you own.'
      }
    >
      {(completing || consenting) &&
        (pending.error ? (
          <p role="alert" className="form-alert">
            Provider sign-in expired. Start sign-in again.
          </p>
        ) : (
          <p className="auth-subtitle">
            {consenting
              ? 'Your existing Ovelo account needs your acknowledgement of the current Terms and Privacy Policy.'
              : `${pending.data?.data.provider === 'discord' ? 'Discord' : 'Your provider'} verified your identity. Add an approved email and a recovery password below, then verify the email to finish registration.`}
          </p>
        ))}
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        {!consenting && (
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
        {!consenting && (
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
        {!consenting && (
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
          {consenting ? (
            'Accept and continue'
          ) : (
            <>
              Create my Ovelo <span>→</span>
            </>
          )}
        </Button>
      </form>
      <OAuthButtons />
      <p className="auth-bottom">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
