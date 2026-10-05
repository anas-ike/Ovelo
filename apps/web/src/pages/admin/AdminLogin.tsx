import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { post, get, apiBase } from '../../lib/api';
export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const providers = useQuery({ queryKey: ['oauth-providers'], queryFn: () => get<{ data: { google: boolean; discord: boolean } }>('/auth/providers') });
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await post<{ data: { url: string } }>('/admin/login', { email, password });
      window.location.assign(result.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to authenticate.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <Logo />
        <div className="admin-shield">
          <ShieldCheck size={23} />
        </div>
        <span className="eyebrow">RESTRICTED CONSOLE</span>
        <h1>Administrator sign in</h1>
        <p>Manage Ovelo operations with least-privilege access.</p>
        <form onSubmit={submit}>
          {error && <div className="form-alert">{error}</div>}
          <Field label="Administrator email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          <Button type="submit" loading={loading} className="full-button">
            Enter console
          </Button>
        </form>
        <p><Link to="/admin/forgot-password">Forgot administrator password?</Link></p>
        <div className="oauth-options">{(['google', 'discord'] as const).map(provider => providers.data?.data[provider] ? <a key={provider} className="oauth-button" href={`${apiBase}/admin/oauth/${provider}`}>Continue with {provider === 'google' ? 'Google' : 'Discord'}</a> : <button key={provider} className="oauth-button" disabled>Continue with {provider === 'google' ? 'Google' : 'Discord'}</button>)}</div>
        <p className="field-hint">Provider identities must be invited and explicitly linked in an authenticated administrator session.</p>
        <p><Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></p>
      </div>
    </div>
  );
}
