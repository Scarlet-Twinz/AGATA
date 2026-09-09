import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const groups = [
  { label: "Main", links: [["Command Center", "/dashboard"]] },
  { label: "Work", links: [["Projects", "/projects"], ["Contractors", "/contractors"], ["Requirements", "/requirements"], ["Evidence", "/evidence"], ["Readiness", "/readiness"]] },
  { label: "Intelligence", links: [["Rumi", "/rumi"], ["Insights", "/insights"]] },
  { label: "Business", links: [["Billing & Plan", "/billing"], ["Usage", "/usage"]] },
] as const;

const adminLinks = [["Team", "/team"], ["Notifications", "/notifications"], ["Audit Trail", "/audit"], ["Settings", "/settings"]] as const;

const symbols: Record<string, string> = {
  "Command Center": "⌂",
  Projects: "◈",
  Contractors: "◎",
  Requirements: "≡",
  Evidence: "◇",
  Readiness: "◉",
  Rumi: "R",
  Insights: "✦",
  "Billing & Plan": "◇",
  Usage: "▥",
  Team: "♙",
  Notifications: "◌",
  "Audit Trail": "↗",
  Settings: "⚙",
};

export function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(() => localStorage.getItem("agata_sidebar_collapsed") === "true");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem("agata_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  const current = groups
    .flatMap((group) => group.links)
    .concat(adminLinks)
    .find(([, to]) => location.pathname === to)?.[0] ?? "Command Center";

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "sidebar-mobile-open" : ""}`}>
      <button className="sidebar-scrim" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />

      <aside className="sidebar" aria-label="AGATA workspace navigation">
        <div className="workspace-brand">
          <span className="workspace-mark"><img src="/agata-mark.svg" alt="AGATA" /></span>
          <div className="workspace-brand-copy"><strong>AGATA</strong><span>Compliance. Assured.</span></div>
          <button className="sidebar-collapse" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        <div className="workspace-context">
          <span className="workspace-context-dot" />
          <span className="workspace-context-label">AGATA Workspace</span>
        </div>

        <nav className="workspace-nav" aria-label="Workspace navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.links.map(([label, to]) => (
                <NavLink key={to} to={to} title={label} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                  <span className="nav-symbol">{symbols[label]}</span>
                  <span className="nav-label">{label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="nav-group nav-group-admin">
            <div className="nav-group-label">Admin</div>
            {adminLinks.map(([label, to]) => (
              <NavLink key={to} to={to} title={label} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                <span className="nav-symbol">{symbols[label]}</span>
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="plan-mini">
            <span>Workspace plan</span>
            <strong>Billing not configured</strong>
            <NavLink to="/billing">Manage plan <b>→</b></NavLink>
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">{(user?.full_name ?? "A").charAt(0).toUpperCase()}</span>
            <div className="user-meta">
              <strong>{user?.full_name ?? "Workspace"}</strong>
              <span>{user?.email ?? ""}</span>
            </div>
            <button type="button" onClick={handleSignOut} aria-label="Sign out" title="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="workspace-topbar">
          <div className="topbar-left">
            <button className="mobile-sidebar-button" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">☰</button>
            <div>
              <span className="topbar-kicker">Workspace</span>
              <span className="topbar-section">{current}</span>
            </div>
          </div>
          <div className="topbar-tools">
            <label className="workspace-search">
              <span>⌕</span>
              <input aria-label="Search workspace" placeholder="Search projects, contractors, evidence..." />
              <kbd>/</kbd>
            </label>
            <button className="notification-button" type="button" onClick={() => navigate("/notifications")} aria-label="Notifications">◌<span className="notification-dot">3</span></button>
            <button className="theme-switch" type="button" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label="Toggle workspace theme">
              <span>{theme === "dark" ? "☼" : "◐"}</span>
              <small>{theme === "dark" ? "Dark" : "Light"}</small>
            </button>
            <button className="topbar-avatar" type="button" onClick={() => navigate("/settings")} aria-label={`Open settings for ${firstName}`}>
              {(user?.full_name ?? "A").charAt(0).toUpperCase()}{(user?.full_name ?? "").split(" ")[1]?.charAt(0).toUpperCase() ?? ""}
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
