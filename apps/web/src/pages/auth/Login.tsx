import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { useAuth } from '../../features/auth/AuthProvider';
import { apiBase } from '../../lib/api';
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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
      navigate(next || '/dashboard', { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your private inventory.">
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
        <div className="auth-divider">
          <span>or</span>
        </div>
        <a className="oauth-button" href={`${apiBase}/auth/google`}>
          <span className="google-mark">G</span> Continue with Google
        </a>
      </form>
      <p className="auth-bottom">
        New to Ovelo? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  );
}
