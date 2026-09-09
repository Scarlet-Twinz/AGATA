import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const links = [
  ["Dashboard", "/dashboard"],
  ["Projects", "/projects"],
  ["Contractors", "/contractors"],
  ["Requirements", "/requirements"],
  ["Evidence", "/evidence"],
  ["Rumi", "/rumi"],
  ["Settings", "/settings"],
] as const;

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>AGATA</span></div>
        <nav>
          {links.map(([label, to]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">Compliance intelligence</div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div><span className="status-dot" /> System online</div>
          <div className="topbar-account">
            <div className="topbar-user">{user?.full_name ?? "Workspace"}</div>
            <button className="topbar-signout" type="button" onClick={handleSignOut}>Sign out</button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
