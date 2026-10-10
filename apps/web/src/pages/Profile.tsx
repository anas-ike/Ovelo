import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound, Trash2 } from 'lucide-react';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { get, patch, post, del, upload, apiBase } from '../lib/api';
import { useAuth } from '../features/auth/AuthProvider';
import { OAuthButtons } from '../features/auth/OAuthButtons';

type ProfileData = {
  user: { id: string; name: string; email: string; hasAvatar?: boolean; createdAt: string };
  accounts: { provider: string; createdAt: string }[];
  subscription: { status: string; provider: string; expiresAt: string | null; plan: { code: string; name: string } } | null;
};

export function Profile() {
  const { refresh } = useAuth();
  const client = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const profile = useQuery({ queryKey: ['auth-profile'], queryFn: () => get<{ data: ProfileData }>('/auth/profile') });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const current = profile.data?.data;

  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await fn(); setMessage(success); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The update could not be completed.'); }
    finally { setBusy(false); }
  }
  if (profile.isPending) return <div className="profile-page"><p>Loading your profile…</p></div>;
  if (profile.error || !current) return <div className="profile-page"><p role="alert" className="form-alert">Could not load your profile.</p></div>;
  const displayName = name || current.user.name;
  return (
    <div className="profile-page">
      <div className="generic-head">
        <div><h2>Profile</h2><p>Manage your profile, sign-in methods, and subscription.</p></div>
        <span className="generic-head-icon"><UserRound size={23} /></span>
      </div>
      {error && <p role="alert" className="form-alert">{error}</p>}
      {message && <p role="status" className="success-note">{message}</p>}
      <div className="profile-grid">
        <section className="detail-section records-stack">
          <h3>Profile picture</h3>
          <div className="profile-picture-row">
            {current.user.hasAvatar ? <img className="profile-picture" src={`${apiBase}/auth/avatar?profile=${Date.now()}`} alt="Your profile" /> : <div className="profile-picture profile-picture-fallback">{current.user.name.slice(0, 1).toUpperCase()}</div>}
            <div className="records-stack">
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => {
                const selected = event.target.files?.[0];
                if (!selected) return;
                const form = new FormData(); form.append('file', selected);
                void run(async () => { await upload('/auth/avatar', form); await client.invalidateQueries({ queryKey: ['auth-profile'] }); await refresh(); }, 'Profile picture updated.');
              }} />
              <Button type="button" variant="ghost" disabled={busy} onClick={() => file.current?.click()}>Choose picture</Button>
              {current.user.hasAvatar && <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(async () => { await del('/auth/avatar'); await client.invalidateQueries({ queryKey: ['auth-profile'] }); await refresh(); }, 'Profile picture removed.') }><Trash2 size={15} /> Remove picture</Button>}
              <small>JPG, PNG, or WEBP up to 5 MB.</small>
            </div>
          </div>
        </section>
        <form className="detail-section records-stack" onSubmit={(event) => { event.preventDefault(); void run(async () => { await patch('/auth/profile', { name: displayName }); await client.invalidateQueries({ queryKey: ['auth-profile'] }); await refresh(); }, 'Profile saved.'); }}>
          <h3>Personal details</h3>
          <Field label="Name"><Input required maxLength={100} value={displayName} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="Email"><Input value={current.user.email} readOnly /></Field>
          <p className="field-hint">Your verified sign-in email.</p>
          <Button type="submit" loading={busy}>Save profile</Button>
        </form>
        <section className="detail-section records-stack">
          <h3>Sign-in methods</h3>
          <p>{current.accounts.length ? current.accounts.map((account) => account.provider.charAt(0).toUpperCase() + account.provider.slice(1)).join(' · ') : 'Email password only'}</p>
          <OAuthButtons mode="link" />
          <Link className="text-button" to="/settings">Account settings →</Link>
        </section>
        <section className="detail-section records-stack">
          <h3>Subscription</h3>
          <p><strong>{current.subscription?.plan.name || 'Free'}</strong> · {current.subscription?.status || 'ACTIVE'}</p>
          {current.subscription?.expiresAt && <small>Active until {new Date(current.subscription.expiresAt).toLocaleDateString()}</small>}
          <form className="inline-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { await post('/auth/subscription/redeem', { code }); setCode(''); await client.invalidateQueries({ queryKey: ['auth-profile'] }); }, 'Premium activated.'); }}>
            <Field label="Premium code"><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="OVL-PREMIUM-…" autoComplete="off" required /></Field>
            <Button type="submit" loading={busy}>Redeem code</Button>
          </form>
        </section>
      </div>
    </div>
  );
}
