import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const groups = [
  { label: "Workspace", links: [["Command Center", "/dashboard"], ["Projects", "/projects"], ["Contractors", "/contractors"], ["Requirements", "/requirements"], ["Evidence", "/evidence"], ["Readiness", "/readiness"]] },
  { label: "Intelligence", links: [["Rumi", "/rumi"], ["Insights", "/insights"]] },
  { label: "Business", links: [["Billing & Plan", "/billing"], ["Usage", "/usage"]] },
  { label: "Admin", links: [["Team", "/team"], ["Notifications", "/notifications"], ["Audit Trail", "/audit"], ["Settings", "/settings"] },
] as const;

const symbols: Record<string, string> = { "Command Center": "⌂", Projects: "◈", Contractors: "◎", Requirements: "≡", Evidence: "◇", Readiness: "◉", Rumi: "R", Insights: "✦", "Billing & Plan": "◇", Usage: "▥", Team: "♙", Notifications: "◌", "Audit Trail": "↗", Settings: "⚙" };

export function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  const current = groups.flatMap(group => group.links).find(([, to]) => location.pathname === to)?.[0] ?? "Command Center";

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="workspace-brand"><span className="workspace-mark">A</span><span className="workspace-brand-name">AGATA</span><button className="sidebar-collapse" type="button" onClick={() => setCollapsed(v => !v)} aria-label="Toggle sidebar">{collapsed ? "→" : "←"}</button></div>
        <div className="workspace-context"><span className="workspace-context-dot" /><span className="workspace-context-label">AGATA Workspace</span></div>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          {groups.map(group => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.links.map(([label, to]) => <NavLink key={to} to={to} title={label} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><span className="nav-symbol">{symbols[label] ?? label.charAt(0)}</span><span className="nav-label">{label}</span></NavLink>)}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="plan-mini"><span>Plan</span><strong>Billing not configured</strong><NavLink to="/billing">Manage plan <b>→</b></NavLink></div><div className="sidebar-user"><span className="user-avatar">{(user?.full_name ?? "A").charAt(0).toUpperCase()}</span><div className="user-meta"><strong>{user?.full_name ?? "Workspace"}</strong><span>{user?.email ?? ""}</span></div><button type="button" onClick={handleSignOut} aria-label="Sign out">↗</button></div></div>
      </aside>
      <main className="main-content">
        <header className="workspace-topbar"><div className="topbar-left"><button className="mobile-sidebar-button" type="button" onClick={() => setCollapsed(v => !v)}>☰</button><div><span className="topbar-kicker">Workspace</span><span className="topbar-section">{current}</span></div></div><div className="topbar-tools"><label className="workspace-search"><span>⌕</span><input aria-label="Search workspace" placeholder="Search workspace" /></label><button className="theme-switch" type="button" onClick={toggleTheme} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-label="Toggle workspace theme"><span>{theme === "dark" ? "☼" : "◐"}</span><small>{theme === "dark" ? "Dark" : "Light"}</small></button><button className="notification-button" type="button" onClick={() => navigate("/notifications")} aria-label="Notifications">◌</button></div></header>
        <Outlet />
      </main>
    </div>
  );
}
