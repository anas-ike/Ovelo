import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { post } from '../../lib/api';
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await post('/auth/reset-password', { token: params.get('token'), password });
      navigate('/login?reset=success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This reset link is no longer valid.');
    } finally {
      setLoading(false);
    }
  };
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Make it strong. Your inventory is worth protecting."
    >
      <form className="auth-form" onSubmit={submit}>
        {error && <div className="form-alert">{error}</div>}
        <Field label="New password" hint="At least 12 characters">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={12}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Confirm password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={12}
            autoComplete="new-password"
            required
          />
        </Field>
        <Button type="submit" loading={loading} className="full-button">
          Update password
        </Button>
        <Link className="muted-link centered" to="/login">
          Back to sign in
        </Link>
      </form>
    </AuthShell>
  );
}
