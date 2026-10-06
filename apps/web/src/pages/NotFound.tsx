import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function NotFound() {
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
          <Link to="/login">Sign in</Link>
        </nav>
      </header>
      <main id="main-content" className="not-found">
        <span className="eyebrow">OVELO / 404</span>
        <h1>Page not found</h1>
        <p>This page may have moved, or the address may be incorrect.</p>
        <div className="record-actions">
          <Link className="button button-primary" to="/">
            Go home
          </Link>
          <Link className="button button-ghost" to="/dashboard">
            Open my inventory
          </Link>
        </div>
      </main>
    </div>
  );
}
