import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const groups = [
  { label: "Workspace", links: [["Command Center", "/dashboard"], ["Projects", "/projects"], ["Contractors", "/contractors"], ["Requirements", "/requirements"], ["Evidence", "/evidence"], ["Readiness", "/readiness"]] },
  { label: "Intelligence", links: [["Rumi", "/rumi"], ["Insights", "/insights"]] },
  { label: "Business", links: [["Billing & Plan", "/billing"], ["Usage", "/usage"]] },
  { label: "Admin", links: [["Team", "/team"], ["Notifications", "/notifications"], ["Audit Trail", "/audit"], ["Settings", "/settings"]] },
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("agata_theme") ?? "dark");

  function changeTheme(next: string) {
    setTheme(next);
    localStorage.setItem("agata_theme", next);
    document.documentElement.dataset.appTheme = next;
  }

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="workspace-brand"><span className="workspace-mark">A</span><span className="workspace-brand-name">AGATA</span><button className="sidebar-collapse" type="button" onClick={() => setCollapsed(v => !v)} aria-label="Toggle sidebar">{collapsed ? "→" : "←"}</button></div>
        <div className="workspace-context"><span className="workspace-context-dot" /> <span>AGATA Workspace</span></div>
        <nav className="workspace-nav">
          {groups.map(group => <div className="nav-group" key={group.label}><div className="nav-group-label">{group.label}</div>{group.links.map(([label, to]) => <NavLink key={to} to={to} title={label} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}><span className="nav-symbol">{label.charAt(0)}</span><span className="nav-label">{label}</span></NavLink>)}</div>)}
        </nav>
        <div className="sidebar-bottom"><div className="plan-mini"><span>Current plan</span><strong>Starter</strong><NavLink to="/billing">Manage plan →</NavLink></div><div className="sidebar-user"><span className="user-avatar">{(user?.full_name ?? "A").charAt(0).toUpperCase()}</span><div className="user-meta"><strong>{user?.full_name ?? "Workspace"}</strong><span>{user?.email ?? ""}</span></div><button type="button" onClick={handleSignOut} aria-label="Sign out">↗</button></div></div>
      </aside>
      <main className="main-content">
        <header className="workspace-topbar"><div className="topbar-left"><button className="mobile-sidebar-button" type="button" onClick={() => setCollapsed(v => !v)}>☰</button><span className="topbar-section">Command Center</span></div><div className="topbar-tools"><label className="workspace-search"><span>⌕</span><input placeholder="Search workspace" /></label><div className="theme-switch" aria-label="Theme"><button className={theme === "light" ? "selected" : ""} onClick={() => changeTheme("light")} type="button">☼</button><button className={theme === "dark" ? "selected" : ""} onClick={() => changeTheme("dark")} type="button">◐</button></div><button className="notification-button" type="button" onClick={() => navigate("/notifications")} aria-label="Notifications">◌</button></div></header>
        <Outlet />
      </main>
    </div>
  );
}
