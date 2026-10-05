import { Logo } from '../../components/Logo';
import { Link } from 'react-router-dom';
export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="auth-page">
      <div className="auth-visual">
        <Logo />
        <div>
          <span className="eyebrow">WHAT DO I OWN?</span>
          <div className="visual-title" aria-hidden="true">
            A clearer
            <br />
            <em>record of life.</em>
          </div>
          <p>Keep the details that matter close, private, and easy to find.</p>
        </div>
        <span className="auth-visual-foot">Ovelo — Know what you own.</span>
      </div>
      <div className="auth-panel">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className="auth-form-wrap">
          <span className="eyebrow">WELCOME TO OVELO</span>
          <h1>{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <p className="auth-legal">
            <Link to="/terms">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link> ·{' '}
            <Link to="/how-it-works">How it works</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
