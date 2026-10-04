import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { post } from '../../lib/api';
export function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await post('/admin/login', { email, password });
      navigate('/admin');
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
      </div>
    </div>
  );
}
