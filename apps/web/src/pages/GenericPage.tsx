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
        <section className="detail-section">
          <h3>Connect a provider to this account</h3>
          <p>
            Connecting a provider lets that identity sign in to your current Ovelo account. To
            switch accounts, sign out and use the sign-in page.
          </p>
          <OAuthButtons mode="link" />
        </section>
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
