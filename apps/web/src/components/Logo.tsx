import { Link } from 'react-router-dom';
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" to={compact ? '/dashboard' : '/'} aria-label="Ovelo home">
      <span className="brand-mark">
        <span />
      </span>
      {!compact && <span className="brand-name">ovelo</span>}
    </Link>
  );
}
