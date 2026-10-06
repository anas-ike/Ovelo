import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthProvider';
import { AuthShell } from './AuthShell';
import { OAuthButtons } from '../../features/auth/OAuthButtons';

export function OAuthComplete() {
  const { confirmProviderSignIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void confirmProviderSignIn().then(() => {
      if (active) navigate('/dashboard', { replace: true });
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Unable to confirm your sign-in. Please try again.');
    });
    return () => { active = false; };
  }, [confirmProviderSignIn, navigate]);
  return (
    <AuthShell title={error ? 'Sign-in could not finish' : 'Finishing sign-in'} subtitle="Confirming your account before opening your private inventory.">
      {error ? <>
        <p role="alert" className="form-alert">{error}</p>
        <OAuthButtons />
        <p className="auth-bottom"><Link to="/login">Return to sign in</Link></p>
      </> : <p role="status">Checking your sign-in session…</p>}
    </AuthShell>
  );
}
