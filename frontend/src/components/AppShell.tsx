import React from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

type IconName =
  | "home"
  | "folder"
  | "users"
  | "requirements"
  | "evidence"
  | "readiness"
  | "rumi"
  | "insights"
  | "billing"
  | "usage"
  | "team"
  | "notifications"
  | "audit"
  | "settings"
  | "search"
  | "sun"
  | "moon"
  | "menu"
  | "chevron";

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </svg>
      );

    case "folder":
      return (
        <svg {...common}>
          <path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5" />
          <path d="M18 14.5a5 5 0 0 1 2.5 4.5" />
        </svg>
      );

    case "requirements":
      return (
        <svg {...common}>
          <path d="M6 4h12" />
          <path d="M6 8h12" />
          <path d="M6 12h12" />
          <path d="M6 16h8" />
          <path d="M4 4h.01" />
          <path d="M4 8h.01" />
          <path d="M4 12h.01" />
          <path d="M4 16h.01" />
        </svg>
      );

    case "evidence":
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v5h5" />
          <path d="M10 13h5" />
          <path d="M10 17h5" />
        </svg>
      );

    case "readiness":
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      );

    case "rumi":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9h6" />
          <path d="M9 12h5" />
          <path d="M9 15h4" />
        </svg>
      );

    case "insights":
      return (
        <svg {...common}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-8" />
          <path d="M22 19V3" />
        </svg>
      );

    case "billing":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M7 15h4" />
        </svg>
      );

    case "usage":
      return (
        <svg {...common}>
          <path d="M5 20V10" />
          <path d="M12 20V4" />
          <path d="M19 20v-7" />
        </svg>
      );

    case "team":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M14 18a4.5 4.5 0 0 1 6 2" />
        </svg>
      );

    case "notifications":
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
      );

    case "audit":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 6h12l-2.5 3L16 12H4" />
          <path d="M18 15h3" />
          <path d="M18 19h3" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V20h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6v-2.6h.5A1.7 1.7 0 0 0 8 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V5H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.5V14h-.5a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      );

    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 5 5" />
        </svg>
      );

    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m4.93 19.07 1.41-1.41" />
          <path d="m17.66 6.34 1.41-1.41" />
        </svg>
      );

    case "moon":
      return (
        <svg {...common}>
          <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4a8.5 8.5 0 1 0 11.5 11.5Z" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    default:
      return null;
  }
}

const navigation = [
  {
    title: "MAIN",
    items: [
      {
        label: "Command Center",
        path: "/dashboard",
        icon: "home" as IconName,
      },
    ],
  },
  {
    title: "WORK",
    items: [
      {
        label: "Projects",
        path: "/projects",
        icon: "folder" as IconName,
      },
      {
        label: "Contractors",
        path: "/contractors",
        icon: "users" as IconName,
      },
      {
        label: "Requirements",
        path: "/requirements",
        icon: "requirements" as IconName,
      },
      {
        label: "Evidence",
        path: "/evidence",
        icon: "evidence" as IconName,
      },
      {
        label: "Readiness",
        path: "/readiness",
        icon: "readiness" as IconName,
      },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      {
        label: "Rumi",
        path: "/rumi",
        icon: "rumi" as IconName,
      },
      {
        label: "Insights",
        path: "/insights",
        icon: "insights" as IconName,
      },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      {
        label: "Billing & Plan",
        path: "/billing",
        icon: "billing" as IconName,
      },
      {
        label: "Usage",
        path: "/usage",
        icon: "usage" as IconName,
      },
    ],
  },
  {
    title: "ADMIN",
    items: [
      {
        label: "Team",
        path: "/team",
        icon: "team" as IconName,
      },
      {
        label: "Notifications",
        path: "/notifications",
        icon: "notifications" as IconName,
      },
      {
        label: "Audit Trail",
        path: "/audit",
        icon: "audit" as IconName,
      },
      {
        label: "Settings",
        path: "/settings",
        icon: "settings" as IconName,
      },
    ],
  },
];

export function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const initials = (user?.full_name || "AG")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  function handleSignOut() {
    signOut();
    navigate("/login", { replace: true });
  }

  return (
    <>
      <style>{`
        .agata-shell {
          --agata-sidebar: 228px;
          --agata-sidebar-collapsed: 76px;
          --agata-topbar: 64px;
          min-height: 100vh;
          display: grid;
          grid-template-columns: var(--agata-sidebar) minmax(0, 1fr);
          background: #07111d;
          color: #edf4fb;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .agata-shell.collapsed {
          grid-template-columns: var(--agata-sidebar-collapsed) minmax(0, 1fr);
        }

        .agata-sidebar {
          position: sticky;
          top: 0;
          height: 100vh;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-right: 1px solid #172b40;
          background:
            radial-gradient(
              circle at 20% 0%,
              rgba(37, 103, 179, .12),
              transparent 35%
            ),
            linear-gradient(
              180deg,
              #091828 0%,
              #07121f 100%
            );
          z-index: 50;
        }

        .agata-brand {
          height: 76px;
          flex: 0 0 76px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 18px;
          border-bottom: 1px solid rgba(42, 68, 95, .38);
        }

        /*
          The source logo is a complete horizontal logo.
          We intentionally crop its left mark instead of
          squeezing the whole logo into a square.
        */
        .agata-brand-mark {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          position: relative;
          overflow: hidden;
          border-radius: 8px;
          background: #071321;
        }

        .agata-brand-mark img {
          position: absolute;
          left: 0;
          top: 50%;
          width: 108px;
          height: auto;
          max-width: none;
          display: block;
          transform: translateY(-50%);
        }

        .agata-brand-copy {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .agata-brand-copy strong {
          color: #f5f8fc;
          font-size: 16px;
          line-height: 1;
          letter-spacing: .04em;
        }

        .agata-brand-copy span {
          color: #7f95ad;
          font-size: 9px;
          white-space: nowrap;
        }

        .agata-collapse {
          width: 26px;
          height: 26px;
          margin-left: auto;
          border: 1px solid #223b54;
          border-radius: 7px;
          background: #0b1b2b;
          color: #8196ad;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .agata-collapse:hover {
          color: #dbe9f8;
          border-color: #355674;
        }

        .agata-workspace-chip {
          margin: 16px 14px 4px;
          min-height: 36px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border: 1px solid #1a3148;
          border-radius: 8px;
          background: rgba(12, 30, 48, .72);
        }

        .agata-workspace-dot {
          width: 7px;
          height: 7px;
          flex: 0 0 7px;
          border-radius: 50%;
          background: #37d9a2;
          box-shadow: 0 0 10px rgba(55, 217, 162, .4);
        }

        .agata-workspace-chip span:last-child {
          color: #9aacc0;
          font-size: 10px;
          font-weight: 600;
        }

        .agata-nav {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 10px 10px 18px;
          scrollbar-width: thin;
          scrollbar-color: #203950 transparent;
        }

        .agata-nav-group {
          margin-top: 13px;
        }

        .agata-nav-group:first-child {
          margin-top: 4px;
        }

        .agata-nav-title {
          padding: 0 10px 8px;
          color: #607993;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .14em;
        }

        .agata-nav-link {
          min-height: 38px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 10px;
          margin-bottom: 2px;
          border: 1px solid transparent;
          border-radius: 7px;
          color: #8fa4ba;
          text-decoration: none;
          font-size: 12px;
          font-weight: 500;
          transition:
            background .15s ease,
            color .15s ease,
            border-color .15s ease;
        }

        .agata-nav-link:hover {
          color: #e1ebf6;
          background: rgba(24, 52, 79, .52);
        }

        .agata-nav-link.active {
          color: #f4f8fd;
          background:
            linear-gradient(
              90deg,
              #0e59bd,
              #0d4da3
            );
          border-color: rgba(68, 145, 244, .34);
          box-shadow: 0 8px 22px rgba(0, 72, 170, .18);
        }

        .agata-nav-icon {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
          display: grid;
          place-items: center;
          color: #7891aa;
        }

        .agata-nav-link.active .agata-nav-icon {
          color: #f5f9ff;
        }

        .agata-nav-label {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .agata-sidebar-bottom {
          padding: 12px;
          border-top: 1px solid #172b40;
        }

        .agata-plan {
          padding: 12px;
          margin-bottom: 10px;
          border: 1px solid #1a3045;
          border-radius: 9px;
          background: rgba(9, 26, 42, .72);
        }

        .agata-plan span {
          display: block;
          color: #617b95;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .agata-plan strong {
          display: block;
          margin-top: 5px;
          color: #b8c7d7;
          font-size: 10px;
        }

        .agata-plan a {
          display: block;
          margin-top: 8px;
          color: #4c9af5;
          font-size: 10px;
        }

        .agata-user {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 4px;
        }

        .agata-user-avatar {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #f2f7fd;
          background: linear-gradient(
            145deg,
            #2456a8,
            #173e83
          );
          border: 1px solid #3269ba;
          font-size: 10px;
          font-weight: 700;
        }

        .agata-user-copy {
          min-width: 0;
          flex: 1;
        }

        .agata-user-copy strong,
        .agata-user-copy span {
          display: block;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .agata-user-copy strong {
          color: #e6edf5;
          font-size: 10px;
        }

        .agata-user-copy span {
          margin-top: 2px;
          color: #667f99;
          font-size: 8px;
        }

        .agata-signout {
          width: 28px;
          height: 28px;
          border: 0;
          background: transparent;
          color: #607892;
          cursor: pointer;
        }

        .agata-signout:hover {
          color: #d6e5f5;
        }

        .agata-main {
          min-width: 0;
          min-height: 100vh;
          background:
            radial-gradient(
              circle at 72% -10%,
              rgba(24, 73, 123, .13),
              transparent 34%
            ),
            #07111d;
        }

        .agata-topbar {
          height: var(--agata-topbar);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 24px 0 30px;
          border-bottom: 1px solid #15293d;
          background: rgba(7, 17, 29, .9);
          backdrop-filter: blur(16px);
          position: sticky;
          top: 0;
          z-index: 30;
        }

        .agata-topbar-left {
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .agata-mobile-menu {
          display: none;
          width: 36px;
          height: 36px;
          border: 1px solid #21384f;
          border-radius: 8px;
          background: #0a1b2b;
          color: #b8c9da;
        }

        .agata-topbar-kicker {
          display: block;
          color: #607995;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: .12em;
          font-weight: 700;
        }

        .agata-topbar-section {
          display: block;
          margin-top: 2px;
          color: #dce7f2;
          font-size: 12px;
          font-weight: 650;
        }

        .agata-topbar-tools {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .agata-search {
          width: min(335px, 30vw);
          height: 38px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border: 1px solid #20384f;
          border-radius: 9px;
          background: #091a2b;
          color: #7189a2;
        }

        .agata-search input {
          flex: 1;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #dce7f2;
          font-size: 11px;
        }

        .agata-search input::placeholder {
          color: #667d96;
        }

        .agata-search kbd {
          min-width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border: 1px solid #20364d;
          border-radius: 5px;
          color: #7890a8;
          font-size: 9px;
        }

        .agata-tool-button {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid #1d344a;
          border-radius: 9px;
          background: #091a2b;
          color: #8ca2b8;
          cursor: pointer;
        }

        .agata-tool-button:hover {
          color: #e6eef7;
          border-color: #35546f;
        }

        .agata-top-avatar {
          width: 38px;
          height: 38px;
          margin-left: 2px;
          border: 1px solid #2d5ca7;
          border-radius: 50%;
          background: linear-gradient(
            145deg,
            #244f9a,
            #173e7e
          );
          color: #edf5ff;
          font-size: 10px;
          font-weight: 750;
          cursor: pointer;
        }

        .agata-content {
          min-width: 0;
        }

        .agata-shell.collapsed .agata-brand-copy,
        .agata-shell.collapsed .agata-workspace-chip span:last-child,
        .agata-shell.collapsed .agata-nav-title,
        .agata-shell.collapsed .agata-nav-label,
        .agata-shell.collapsed .agata-plan,
        .agata-shell.collapsed .agata-user-copy,
        .agata-shell.collapsed .agata-signout {
          display: none;
        }

        .agata-shell.collapsed .agata-brand {
          justify-content: center;
          padding: 0;
        }

        .agata-shell.collapsed .agata-collapse {
          display: none;
        }

        .agata-shell.collapsed .agata-workspace-chip {
          justify-content: center;
          margin-inline: 14px;
          padding: 0;
        }

        .agata-shell.collapsed .agata-nav-link {
          justify-content: center;
          padding-inline: 0;
        }

        .agata-shell.collapsed .agata-sidebar-bottom {
          padding-inline: 10px;
        }

        .agata-shell.collapsed .agata-user {
          justify-content: center;
        }

        .agata-mobile-scrim {
          display: none;
        }

        @media (max-width: 1050px) {
          .agata-search {
            width: 250px;
          }

          .agata-brand-copy span {
            display: none;
          }
        }

        @media (max-width: 820px) {
          .agata-shell,
          .agata-shell.collapsed {
            display: block;
          }

          .agata-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 228px;
            transform: translateX(-100%);
            transition: transform .2s ease;
          }

          .agata-shell.mobile-open .agata-sidebar {
            transform: translateX(0);
          }

          .agata-mobile-scrim {
            display: block;
            position: fixed;
            inset: 0;
            z-index: 45;
            background: rgba(0, 0, 0, .62);
            opacity: 0;
            pointer-events: none;
            transition: opacity .2s ease;
          }

          .agata-shell.mobile-open .agata-mobile-scrim {
            opacity: 1;
            pointer-events: auto;
          }

          .agata-mobile-menu {
            display: grid;
            place-items: center;
          }

          .agata-main {
            min-height: 100vh;
          }

          .agata-topbar {
            padding-inline: 16px;
          }

          .agata-search {
            width: min(290px, 45vw);
          }
        }

        @media (max-width: 560px) {
          .agata-topbar-section {
            display: none;
          }

          .agata-search {
            width: 42px;
            padding: 0 11px;
          }

          .agata-search input,
          .agata-search kbd {
            display: none;
          }

          .agata-tool-button {
            width: 36px;
            height: 36px;
          }
        }
      `}</style>

      <div
        className={`agata-shell ${
          collapsed ? "collapsed" : ""
        } ${mobileOpen ? "mobile-open" : ""}`}
      >
        <button
          className="agata-mobile-scrim"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />

        <aside className="agata-sidebar">
          <div className="agata-brand">
            <span className="agata-brand-mark">
              <img src="/logo.png" alt="" />
            </span>

            <div className="agata-brand-copy">
              <strong>AGATA</strong>
              <span>Compliance. Assured.</span>
            </div>

            <button
              className="agata-collapse"
              type="button"
              onClick={() =>
                setCollapsed((value) => !value)
              }
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
            >
              <Icon name="chevron" size={15} />
            </button>
          </div>

          <div className="agata-workspace-chip">
            <span className="agata-workspace-dot" />
            <span>AGATA Workspace</span>
          </div>

          <nav className="agata-nav">
            {navigation.map((group) => (
              <section
                className="agata-nav-group"
                key={group.title}
              >
                <div className="agata-nav-title">
                  {group.title}
                </div>

                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={({ isActive }) =>
                      `agata-nav-link ${
                        isActive ? "active" : ""
                      }`
                    }
                  >
                    <span className="agata-nav-icon">
                      <Icon
                        name={item.icon}
                        size={17}
                      />
                    </span>

                    <span className="agata-nav-label">
                      {item.label}
                    </span>
                  </NavLink>
                ))}
              </section>
            ))}
          </nav>

          <div className="agata-sidebar-bottom">
            <div className="agata-plan">
              <span>Workspace plan</span>
              <strong>
                Billing not configured
              </strong>
              <NavLink to="/billing">
                Manage plan →
              </NavLink>
            </div>

            <div className="agata-user">
              <span className="agata-user-avatar">
                {initials}
              </span>

              <div className="agata-user-copy">
                <strong>
                  {user?.full_name || "Workspace"}
                </strong>

                <span>
                  {user?.email || ""}
                </span>
              </div>

              <button
                className="agata-signout"
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                aria-label="Sign out"
              >
                ↗
              </button>
            </div>
          </div>
        </aside>

        <main className="agata-main">
          <header className="agata-topbar">
            <div className="agata-topbar-left">
              <button
                className="agata-mobile-menu"
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Icon name="menu" size={18} />
              </button>

              <div>
                <span className="agata-topbar-kicker">
                  Workspace
                </span>

                <span className="agata-topbar-section">
                  {location.pathname === "/dashboard"
                    ? "Command Center"
                    : "AGATA Workspace"}
                </span>
              </div>
            </div>

            <div className="agata-topbar-tools">
              <label className="agata-search">
                <Icon name="search" size={17} />

                <input
                  type="text"
                  aria-label="Search workspace"
                  placeholder="Search projects, contractors, evidence..."
                />

                <kbd>/</kbd>
              </label>

              <button
                className="agata-tool-button"
                type="button"
                onClick={() =>
                  navigate("/notifications")
                }
                aria-label="Notifications"
                title="Notifications"
              >
                <Icon
                  name="notifications"
                  size={17}
                />
              </button>

              <button
                className="agata-tool-button"
                type="button"
                onClick={toggleTheme}
                title={`Switch to ${
                  theme === "dark"
                    ? "light"
                    : "dark"
                } mode`}
                aria-label="Toggle theme"
              >
                <Icon
                  name={
                    theme === "dark"
                      ? "sun"
                      : "moon"
                  }
                  size={18}
                />
              </button>

              <button
                className="agata-top-avatar"
                type="button"
                onClick={() =>
                  navigate("/settings")
                }
                aria-label="Open settings"
              >
                {initials}
              </button>
            </div>
          </header>

          <div className="agata-content">
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}