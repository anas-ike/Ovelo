import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FolderOpen } from 'lucide-react';
import { get } from '../lib/api';
import { EmptyState } from '../components/EmptyState';
import { Loading } from '../components/Loading';
import { Link } from 'react-router-dom';
import { OAuthButtons } from '../features/auth/OAuthButtons';
export function GenericPage({
  title,
  description,
  endpoint,
}: {
  title: string;
  description: string;
  endpoint?: string;
}) {
  const query = useQuery({
    queryKey: ['generic', endpoint],
    queryFn: () => get<{ data: unknown }>(endpoint!),
    enabled: Boolean(endpoint),
  });
  return (
    <div className="generic-page">
      <div className="generic-head">
        <div>
          <span className="eyebrow">OVelo WORKSPACE</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="generic-head-icon">
          <FolderOpen size={23} />
        </span>
      </div>
      {title === 'Settings' ? (
        <SettingsContent />
      ) : endpoint && query.isLoading ? (
        <Loading rows={4} />
      ) : endpoint && query.error ? (
        <div className="page-error">Could not load this section.</div>
      ) : (
        <EmptyState
          title={`Your ${title.toLowerCase()} will live here`}
          description="Add records from the ownership pages and they will appear here, connected to the things they belong to."
          action={
            <Link className="text-button" to="/how-it-works">
              Learn how it works <ArrowUpRight size={15} />
            </Link>
          }
        />
      )}
    </div>
  );
}

function SettingsContent() {
  const profile = useQuery({
    queryKey: ['auth-profile'],
    queryFn: () => get<{ data: { accounts: { provider: string }[]; subscription: { status: string; plan: { code: string; name: string } } | null } }>('/auth/profile'),
  });
  if (profile.isPending) return <Loading rows={4} />;
  if (profile.error) return <div className="page-error">Could not load your settings.</div>;
  const connected = new Set(profile.data.data.accounts.map((account) => account.provider));
  const subscription = profile.data.data.subscription;
  return (
    <div className="records-stack">
      <section className="detail-section">
        <h3>Connected sign-in providers</h3>
        <p>
          Connected providers sign in to this Ovelo account. To switch accounts, sign out and use
          the sign-in page.
        </p>
        <p className="settings-provider-status">
          {connected.size ? Array.from(connected).map((provider) => provider.charAt(0).toUpperCase() + provider.slice(1)).join(' · ') : 'No providers connected yet.'}
        </p>
        <OAuthButtons mode="link" />
      </section>
      <section className="detail-section">
        <h3>Subscription</h3>
        <p>{subscription?.plan.name || 'Free'} · {subscription?.status || 'ACTIVE'}</p>
        <Link className="text-button" to="/profile">Manage your profile and subscription →</Link>
      </section>
    </div>
  );
}
