import { Link } from 'react-router-dom';
export function Logo({ compact = false, to }: { compact?: boolean; to?: string }) {
  return (
    <Link className="brand" to={to || (compact ? '/dashboard' : '/')} aria-label={to === '/admin' ? 'Ovelo administration' : 'Ovelo home'}>
      <span className="brand-mark">
        <span />
      </span>
      {!compact && <span className="brand-name">ovelo</span>}
    </Link>
  );
}
