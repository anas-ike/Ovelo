import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { post } from '../../lib/api';
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await post('/auth/forgot-password', { email }).catch(() => undefined);
    setSent(true);
    setLoading(false);
  };
  return (
    <AuthShell title="Reset your password" subtitle="We’ll help you get back to your inventory.">
      {sent ? (
        <div className="verify-card">
          <h3>Check your inbox</h3>
          <p>If an account exists for that address, a reset link is on its way.</p>
          <Link className="button button-primary" to="/login">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </Field>
          <Button loading={loading} type="submit" className="full-button">
            Send reset link
          </Button>
          <Link className="muted-link centered" to="/login">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
