import { ArrowRight, Check, LockKeyhole, ScanLine, ShieldCheck, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <div className="landing-links">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/privacy">Privacy</Link>
          <Link className="text-link" to="/login">
            Sign in <ArrowRight size={15} />
          </Link>
          <Link className="button button-primary button-small" to="/register">
            Get started
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="kicker">
              <Sparkles size={14} /> A private record of what matters
            </div>
            <h1>
              Know what
              <br />
              <em>you own.</em>
            </h1>
            <p className="hero-sub">
              Ovelo brings your things, their details, and the records behind them into one calm,
              private place.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/register">
                Start your inventory <ArrowRight size={17} />
              </Link>
              <Link className="button button-ghost" to="/how-it-works">
                See how it works
              </Link>
            </div>
            <div className="hero-note">
              <LockKeyhole size={14} /> Private by design. Yours by default.
            </div>
          </div>
          <div className="hero-art">
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="inventory-card">
              <div className="inventory-top">
                <span className="mini-mark">o</span>
                <span>MY INVENTORY</span>
                <span className="live-dot" />
              </div>
              <div className="inventory-total">
                <span>Everything I own</span>
                <strong>
                  24 <small>items</small>
                </strong>
              </div>
              <div className="inventory-line">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="inventory-list">
                <div className="inventory-item">
                  <span className="item-art laptop" />
                  <div>
                    <strong>MacBook Pro</strong>
                    <small>Electronics · Study</small>
                  </div>
                  <b>420 KD</b>
                </div>
                <div className="inventory-item">
                  <span className="item-art camera" />
                  <div>
                    <strong>Fujifilm X100V</strong>
                    <small>Electronics · Office</small>
                  </div>
                  <b>850 KD</b>
                </div>
                <div className="inventory-item">
                  <span className="item-art watch" />
                  <div>
                    <strong>Seiko Presage</strong>
                    <small>Accessories · Bedroom</small>
                  </div>
                  <b>290 KD</b>
                </div>
              </div>
              <div className="inventory-footer">
                <span>
                  <span className="status-pill" /> 3 warranties expiring soon
                </span>
                <ArrowRight size={15} />
              </div>
            </div>
          </div>
        </section>
        <section className="trust-row">
          <span>Built for a clearer relationship with what you own</span>
          <div>
            <span>
              <ShieldCheck size={16} /> Private records
            </span>
            <span>
              <ScanLine size={16} /> Scan & find
            </span>
            <span>
              <Check size={16} /> No clutter
            </span>
          </div>
        </section>
        <section id="how" className="feature-section">
          <div className="section-intro">
            <span className="eyebrow">OWNERSHIP, ORGANIZED</span>
            <h2>
              The record behind
              <br />
              every thing.
            </h2>
            <p>Receipts and documents are useful. Your ownership record is the foundation.</p>
          </div>
          <div className="feature-grid">
            <article>
              <span className="feature-number">01</span>
              <h3>Remember the details</h3>
              <p>
                Serial numbers, locations, value, warranty dates, repairs — all connected to the
                thing itself.
              </p>
            </article>
            <article>
              <span className="feature-number">02</span>
              <h3>Find it in a moment</h3>
              <p>
                Search by name, scan a code, or browse your spaces. Ovelo stays fast as your
                inventory grows.
              </p>
            </article>
            <article>
              <span className="feature-number">03</span>
              <h3>Keep the history</h3>
              <p>
                When something is sold, repaired, or moved, the story stays with it. Nothing
                important disappears.
              </p>
            </article>
          </div>
        </section>
        <section id="privacy" className="privacy-section">
          <div>
            <span className="eyebrow">A QUIET KIND OF SECURITY</span>
            <h2>
              Your things.
              <br />
              Your records.
            </h2>
            <p>
              Ovelo is built around the idea that your inventory should belong to you. Server-owned
              access controls, private files, and a clear history — without the noise.
            </p>
            <Link className="text-link" to="/register">
              Create your private record <ArrowRight size={15} />
            </Link>
          </div>
          <div className="privacy-quote">
            <LockKeyhole size={20} />
            <p>“This is where I keep track of everything I own.”</p>
            <span>— the point of Ovelo</span>
          </div>
        </section>
      </main>
      <footer>
        <Logo />
        <span>Ovelo — Know what you own.</span>
        <nav><Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/how-it-works">How it works</Link></nav>
        <span>© {new Date().getFullYear()} Ovelo</span>
      </footer>
    </div>
  );
}
