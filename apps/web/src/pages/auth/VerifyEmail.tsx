import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button } from '../../components/Button';
import { post } from '../../lib/api';
export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(token));
  useEffect(() => {
    if (token)
      void post('/auth/verify-email', { token })
        .then(() => setDone(true))
        .catch((e) => setError(e instanceof Error ? e.message : 'Verification failed.'))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, [token]);
  if (loading)
    return (
      <AuthShell
        title="Verifying your email"
        subtitle="Just a moment while we confirm your address."
      >
        <div className="verify-card">
          <div className="spinner-large" />
        </div>
      </AuthShell>
    );
  return (
    <AuthShell
      title={done ? 'You’re verified' : 'Check your inbox'}
      subtitle={
        done
          ? 'Your private inventory is ready when you are.'
          : `We sent a verification link${params.get('email') ? ` to ${params.get('email')}` : ''}.`
      }
    >
      <div className="verify-card">
        {done ? (
          <CheckCircle2 size={42} className="success-icon" />
        ) : (
          <Mail size={42} className="mail-icon" />
        )}
        <h3>{done ? 'Email verified' : error || 'Open the link in your email'}</h3>
        <p>
          {done
            ? 'Start with one thing you own. You can always add more later.'
            : 'The link is valid for 24 hours. Check your spam folder if you do not see it.'}
        </p>
        {done ? (
          <Button onClick={() => navigate('/login')}>Continue to sign in</Button>
        ) : (
          <Link className="muted-link" to="/login">
            Back to sign in
          </Link>
        )}
      </div>
    </AuthShell>
  );
}
