import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import content from '../public-content.json';
const help = content.help;
const terms = content.terms;
const privacy = content.privacy;
export function PublicInfo({ kind }: { kind: 'help' | 'terms' | 'privacy' }) {
  const rows = kind === 'help' ? help : kind === 'terms' ? terms : privacy,
    title =
      kind === 'help'
        ? 'How Ovelo works'
        : kind === 'terms'
          ? 'Terms of Service'
          : 'Privacy Policy';
  return (
    <div className="landing public-info">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="landing-nav">
        <Logo />
        <nav className="landing-links" aria-label="Public navigation">
          <Link to="/">Home</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/login">Sign in</Link>
        </nav>
      </header>
      <main id="main-content">
        <div className="section-intro">
          <span className="eyebrow">OVELO / {kind}</span>
          <h1>{title}</h1>
          <p>
            {kind === 'help'
              ? 'A practical guide to keeping the record behind everything you own.'
              : 'Last updated: 2026-10-05'}
          </p>
        </div>
        <div className="public-sections">
          {rows.map(([heading, body], i) => (
            <section className="detail-section" key={heading}>
              <span className="eyebrow">{String(i + 1).padStart(2, '0')}</span>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
        {kind === 'help' && (
          <Link className="button button-primary" to="/register">
            Create your Ovelo account
          </Link>
        )}
      </main>
      <footer>
        <Logo />
        <span>Ovelo — Know what you own.</span>
        <nav aria-label="Footer navigation">
          <Link to="/how-it-works">How it works</Link> · <Link to="/terms">Terms</Link> ·{' '}
          <Link to="/privacy">Privacy</Link>
        </nav>
        <a href="mailto:contact@lightsout.in">Contact Ovelo</a>
      </footer>
    </div>
  );
}
