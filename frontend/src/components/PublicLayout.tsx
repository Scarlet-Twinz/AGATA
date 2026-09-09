import { Link, NavLink, Outlet } from "react-router-dom";

const links = [
  ["How it works", "/how-it-works"],
  ["About", "/about"],
  ["FAQ", "/faq"],
  ["Contact", "/contact"],
] as const;

export function PublicLayout() {
  return (
    <div className="public-site">
      <header className="public-nav">
        <Link className="public-brand" to="/">
          <img src="/logo.png" alt="AGATA" />
        </Link>
        <nav className="public-links" aria-label="Main navigation">
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "public-link active" : "public-link"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="public-actions">
          <Link className="text-button" to="/login">Sign in</Link>
          <Link className="primary-button" to="/signup">Get started</Link>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="public-footer">
        <div>
          <Link className="public-brand footer-brand" to="/"><img src="/logo.png" alt="AGATA" /></Link>
          <p>Compliance intelligence for teams that need to know what is ready, what is missing, and what needs attention.</p>
        </div>
        <div className="footer-column"><strong>Product</strong><Link to="/how-it-works">How it works</Link><Link to="/faq">FAQ</Link><Link to="/contact">Support</Link></div>
        <div className="footer-column"><strong>Company</strong><Link to="/about">About</Link><Link to="/contact">Contact</Link></div>
        <div className="footer-column"><strong>Account</strong><Link to="/login">Sign in</Link><Link to="/signup">Get started</Link></div>
        <div className="footer-bottom">© {new Date().getFullYear()} AGATA. Built for evidence-led decisions.</div>
      </footer>
    </div>
  );
}
