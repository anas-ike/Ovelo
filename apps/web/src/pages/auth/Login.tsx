import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { useAuth } from '../../features/auth/AuthProvider';
import { OAuthButtons } from '../../features/auth/OAuthButtons';
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const oauthErrors: Record<string,string> = {
    LINK_REQUIRED: 'An account already uses that email. Sign in with your existing method, then return here to connect the provider.',
    EMAIL_NOT_VERIFIED: 'Verify your email before using provider sign-in.',
    OAUTH_STATE_INVALID: 'This sign-in attempt expired or could not be verified. Please try again.',
    ACCOUNT_ALREADY_LINKED: 'This provider is already connected to another account.',
    ACCOUNT_UNAVAILABLE: 'This account is unavailable.',
    EMAIL_DOMAIN_REQUIRES_APPROVAL: 'Your email domain requires administrator approval.',
    OAUTH_FAILED: 'Provider sign-in could not be completed. Please try again.',
    ADMIN_INVITATION_REQUIRED: 'Administrator identities must be explicitly invited and linked. Use your administrator password to sign in.',
  };
  const providerError = oauthErrors[new URLSearchParams(location.search).get('oauthError') || ''];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const next = new URLSearchParams(location.search).get('next');
      navigate(next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next : '/dashboard', { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your private inventory.">
      {providerError && <p role="alert" className="form-alert">{providerError}</p>}
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            placeholder="Your password"
          />
        </Field>
        <div className="form-row">
          <Link className="muted-link" to="/forgot-password">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={loading} className="full-button">
          Sign in
        </Button>
      </form>
      <OAuthButtons />
      <p className="auth-bottom">
        New to Ovelo? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
