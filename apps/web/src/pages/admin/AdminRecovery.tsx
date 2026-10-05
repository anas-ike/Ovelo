import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { Field, Input } from '../../components/Field';
import { Button } from '../../components/Button';
import { post } from '../../lib/api';
export function AdminRecovery({ reset = false }: { reset?: boolean }) {
  const [params] = useSearchParams(), [value, setValue] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  return <AuthShell title={reset ? 'Reset administrator password' : 'Recover administrator access'} subtitle="Recovery uses expiring, single-use email tickets. Local operators can also run npm run resetpass.">
    {error && <p className="form-alert" role="alert">{error}</p>}{done ? <p role="status">{reset ? 'Password changed. Existing sessions are revoked.' : 'If this administrator account can receive recovery email, a link has been requested.'}</p> : <form className="auth-form" onSubmit={e => { e.preventDefault(); setBusy(true); setError(''); void post(reset ? '/admin/reset-password' : '/admin/forgot-password', reset ? { token: params.get('token'), password: value } : { email: value }).then(() => setDone(true)).catch(e => setError(e.message)).finally(() => setBusy(false)); }}><Field label={reset ? 'New password (at least 16 characters)' : 'Administrator email'}><Input required minLength={reset ? 16 : undefined} maxLength={reset ? 128 : 254} type={reset ? 'password' : 'email'} value={value} onChange={e => setValue(e.target.value)} autoComplete={reset ? 'new-password' : 'email'} /></Field><Button type="submit" loading={busy}>{reset ? 'Reset password' : 'Request recovery link'}</Button></form>}<p><Link to="/admin/login">Administrator sign in</Link></p>
  </AuthShell>;
}
