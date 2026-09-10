import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

const links = [
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
] as const;

const publicLogoStyle = {
  width: "34px",
  height: "34px",
  padding: 0,
  border: 0,
  borderRadius: "8px",
  background: "#071321",
  boxShadow: "none",
  overflow: "hidden",
} as const;

const publicLogoImageStyle = {
  width: "100%",
  height: "100%",
  display: "block",
  objectFit: "contain",
  objectPosition: "center",
} as const;

export function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="public-site">
      <style>{`
        /* Public logo must be the same compact A mark used in the dashboard. */
        .public-brand {
          min-width: 34px !important;
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
          padding: 0 !important;
        }

        .public-brand .logo-badge {
          width: 34px !important;
          height: 34px !important;
          min-width: 34px !important;
          padding: 0 !important;
          border: 0 !important;
          border-radius: 8px !important;
          background: #071321 !important;
          box-shadow: none !important;
          overflow: hidden !important;
          position: relative !important;
        }

        .public-brand .logo-badge img {
          position: static !important;
          inset: auto !important;
          width: 100% !important;
          height: 100% !important;
          max-width: none !important;
          max-height: none !important;
          display: block !important;
          object-fit: contain !important;
          object-position: center !important;
          left: auto !important;
          top: auto !important;
          transform: none !important;
        }

        .footer-brand {
          min-width: 34px !important;
          width: 34px !important;
          height: 34px !important;
          flex: 0 0 34px !important;
        }
      `}</style>

      <header className="public-nav">
        <Link className="public-brand" to="/" aria-label="AGATA home" onClick={() => setMenuOpen(false)}>
          <span className="logo-badge" style={publicLogoStyle}><img src="/agata-mark.png" alt="AGATA" style={publicLogoImageStyle} /></span>
        </Link>
        <nav className="public-links" aria-label="Main navigation">
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "public-link active" : "public-link"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="public-actions">
          <Link className="text-button desktop-auth" to="/login">Sign in</Link>
          <Link className="primary-button desktop-auth" to="/signup">Get started</Link>
          <button
            className={menuOpen ? "mobile-menu-toggle open" : "mobile-menu-toggle"}
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
        </div>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="Mobile navigation">
            {links.map(([label, to]) => (
              <NavLink key={to} to={to} className={({ isActive }) => isActive ? "mobile-menu-link active" : "mobile-menu-link"} onClick={() => setMenuOpen(false)}>
                {label}<span>→</span>
              </NavLink>
            ))}
            <div className="mobile-menu-actions">
              <Link className="secondary-button" to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link>
              <Link className="primary-button" to="/signup" onClick={() => setMenuOpen(false)}>Get started</Link>
            </div>
          </nav>
        )}
      </header>
      <main><Outlet /></main>
      <footer className="public-footer">
        <div>
          <Link className="public-brand footer-brand" to="/"><span className="logo-badge" style={publicLogoStyle}><img src="/agata-mark.png" alt="AGATA" style={publicLogoImageStyle} /></span></Link>
          <p>Compliance intelligence for teams that need to know what is ready, what is missing, and what needs attention.</p>
          <a className="footer-email" href="mailto:anthony@anthonytech.ng">anthony@anthonytech.ng</a>
          <a className="footer-phone" href="tel:09031530359">09031530359</a>
        </div>
        <div className="footer-column"><strong>Product</strong><Link to="/how-it-works">How it works</Link><Link to="/faq">FAQ</Link><Link to="/contact">Support</Link></div>
        <div className="footer-column"><strong>Company</strong><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
        <div className="footer-column"><strong>Account</strong><Link to="/login">Sign in</Link><Link to="/signup">Get started</Link></div>
        <div className="footer-bottom">© {new Date().getFullYear()} AGATA. Built for evidence-led decisions.</div>
      </footer>
    </div>
  );
}