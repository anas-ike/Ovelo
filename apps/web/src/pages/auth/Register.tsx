import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { get, post } from '../../lib/api';
import { OAuthButtons } from '../../features/auth/OAuthButtons';
import { useQuery } from '@tanstack/react-query';
export function Register() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const completing = params.get('oauth') === 'complete';
  const pending = useQuery({ queryKey: ['oauth-pending'], queryFn: () => get<{ data: { provider: string | null } }>('/auth/oauth/pending'), enabled: completing, retry: false });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await post('/auth/register', { name, email, password });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell title="Make it yours" subtitle="Create a private record of everything you own.">
      {completing && (pending.error ? <p role="alert" className="form-alert">Provider registration expired. Start sign-in again.</p> : <p className="auth-subtitle">{pending.data?.data.provider === 'discord' ? 'Discord' : 'Your provider'} verified your identity. Add an approved email and a recovery password below, then verify the email to finish registration.</p>)}
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        <Field label="Your name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            placeholder="How should we call you?"
          />
        </Field>
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
        <Button type="submit" loading={loading} className="full-button">
          Create my Ovelo <span>→</span>
        </Button>
        <p className="terms">By continuing, you agree to keep your records private and secure.</p>
      </form>
      <OAuthButtons />
      <p className="auth-bottom">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
