import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "dark" | "light";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };

const THEME_KEY = "agata_theme";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const lightThemeStyles = `
  html[data-theme="light"] body { background: #f4f7fb !important; color: #172334; }
  html[data-theme="light"] .agata-shell { background: #f4f7fb !important; color: #172334 !important; }
  html[data-theme="light"] .agata-main { background: #f4f7fb !important; }
  html[data-theme="light"] .agata-sidebar { background: #ffffff !important; border-color: #dce5ee !important; }
  html[data-theme="light"] .agata-brand { border-color: #e1e8ef !important; }
  html[data-theme="light"] .agata-brand-mark { background: #eef4f8 !important; }
  html[data-theme="light"] .agata-brand-copy strong { color: #172334 !important; }
  html[data-theme="light"] .agata-brand-copy span { color: #718196 !important; }
  html[data-theme="light"] .agata-collapse { background: #f6f9fb !important; border-color: #d7e1ea !important; color: #52667b !important; }
  html[data-theme="light"] .agata-workspace-chip { background: #f5f9fc !important; border-color: #dce6ee !important; }
  html[data-theme="light"] .agata-workspace-chip span:last-child { color: #52677b !important; }
  html[data-theme="light"] .agata-nav-title { color: #7b8a9d !important; }
  html[data-theme="light"] .agata-nav-link { color: #52667b !important; }
  html[data-theme="light"] .agata-nav-link:hover { background: #f1f5f8 !important; color: #18344d !important; }
  html[data-theme="light"] .agata-nav-link.active { background: #e8f2fb !important; border-color: #cbddeb !important; color: #124b7d !important; box-shadow: none !important; }
  html[data-theme="light"] .agata-nav-link.active .agata-nav-icon { color: #17629d !important; }
  html[data-theme="light"] .agata-sidebar-bottom { border-color: #dce5ee !important; }
  html[data-theme="light"] .agata-plan { background: #f7fafc !important; border-color: #dce6ee !important; }
  html[data-theme="light"] .agata-plan span { color: #77889a !important; }
  html[data-theme="light"] .agata-plan strong { color: #31465a !important; }
  html[data-theme="light"] .agata-user-copy strong { color: #26394c !important; }
  html[data-theme="light"] .agata-user-copy span { color: #7b8c9e !important; }
  html[data-theme="light"] .agata-topbar { background: rgba(255,255,255,.92) !important; border-color: #dce5ee !important; }
  html[data-theme="light"] .agata-topbar-kicker { color: #7a8a9b !important; }
  html[data-theme="light"] .agata-topbar-section { color: #30455a !important; }
  html[data-theme="light"] .agata-search { background: #ffffff !important; border-color: #d5e0e9 !important; color: #6d8094 !important; }
  html[data-theme="light"] .agata-search input { color: #24384d !important; }
  html[data-theme="light"] .agata-search input::placeholder { color: #91a0ae !important; }
  html[data-theme="light"] .agata-search kbd { border-color: #d6e1ea !important; color: #718397 !important; }
  html[data-theme="light"] .agata-tool-button { background: #ffffff !important; border-color: #d5e0e9 !important; color: #526a80 !important; }
  html[data-theme="light"] .agata-tool-button:hover { border-color: #aac4d8 !important; color: #1d5f91 !important; }

  html[data-theme="light"] .agata-dashboard,
  html[data-theme="light"] .projects-page,
  html[data-theme="light"] .contractors-page,
  html[data-theme="light"] .requirements-page,
  html[data-theme="light"] .evidence-page,
  html[data-theme="light"] .readiness-page,
  html[data-theme="light"] .notifications-page,
  html[data-theme="light"] .rumi-page { color: #172334 !important; }

  html[data-theme="light"] .agata-panel,
  html[data-theme="light"] .projects-table,
  html[data-theme="light"] .contractors-table,
  html[data-theme="light"] .requirements-table,
  html[data-theme="light"] .evidence-table,
  html[data-theme="light"] .readiness-table,
  html[data-theme="light"] .notifications-panel,
  html[data-theme="light"] .notifications-stat,
  html[data-theme="light"] .notifications-footer,
  html[data-theme="light"] .project-detail-card,
  html[data-theme="light"] .requirement-detail-card,
  html[data-theme="light"] .rumi-chat-panel,
  html[data-theme="light"] .rumi-context { background: #ffffff !important; border-color: #dce5ee !important; color: #172334 !important; }

  html[data-theme="light"] .agata-kpi-card { background: linear-gradient(180deg,#ffffff,#f7fafc) !important; border-color: #dce5ee !important; color: #172334 !important; }
  html[data-theme="light"] .agata-kpi-card span,
  html[data-theme="light"] .notifications-stat span,
  html[data-theme="light"] .notifications-stat small { color: #718196 !important; }
  html[data-theme="light"] .agata-kpi-card strong { color: #172334 !important; }

  html[data-theme="light"] .notifications-header p,
  html[data-theme="light"] .notifications-panel-head > span,
  html[data-theme="light"] .notification-content p { color: #687b8e !important; }
  html[data-theme="light"] .notification-row { border-color: #e5ebf1 !important; }
  html[data-theme="light"] .notification-row:hover { background: #f7fafc !important; }
  html[data-theme="light"] .notification-content h3 { color: #20354a !important; }
  html[data-theme="light"] .notifications-search { background: #ffffff !important; border-color: #d5e0e9 !important; }
  html[data-theme="light"] .notifications-search input { color: #24384d !important; }

  html[data-theme="light"] .project-row,
  html[data-theme="light"] .contractors-row,
  html[data-theme="light"] .requirements-row,
  html[data-theme="light"] .evidence-row,
  html[data-theme="light"] .readiness-row { border-color: #e5ebf1 !important; }
  html[data-theme="light"] .project-row strong,
  html[data-theme="light"] .contractors-person strong,
  html[data-theme="light"] .requirements-name-cell strong,
  html[data-theme="light"] .evidence-main strong,
  html[data-theme="light"] .readiness-identity strong { color: #20354a !important; }
  html[data-theme="light"] .project-row small,
  html[data-theme="light"] .contractors-person span,
  html[data-theme="light"] .requirements-name-cell span,
  html[data-theme="light"] .evidence-main span,
  html[data-theme="light"] .readiness-identity span { color: #718196 !important; }

  /* Rumi light workspace. */
  html[data-theme="light"] .rumi-page-header h1,
  html[data-theme="light"] .rumi-chat-head strong,
  html[data-theme="light"] .rumi-welcome h2,
  html[data-theme="light"] .rumi-context h2 { color: #172334 !important; }
  html[data-theme="light"] .rumi-page-header p,
  html[data-theme="light"] .rumi-chat-head span,
  html[data-theme="light"] .rumi-welcome p,
  html[data-theme="light"] .rumi-context > p,
  html[data-theme="light"] .rumi-context-list span { color: #6d7e90 !important; }
  html[data-theme="light"] .rumi-chat-head,
  html[data-theme="light"] .rumi-composer { background: #f8fafc !important; border-color: #e0e7ee !important; }
  html[data-theme="light"] .rumi-starters button,
  html[data-theme="light"] .rumi-context-list div { background: #f8fafc !important; border-color: #dbe5ed !important; color: #50677c !important; }
  html[data-theme="light"] .rumi-starters button:hover { background: #eef5fa !important; border-color: #c7d9e6 !important; color: #244a66 !important; }
  html[data-theme="light"] .rumi-message-body { background: #f4f7fa !important; border-color: #dbe4ec !important; color: #2b4053 !important; }
  html[data-theme="light"] .rumi-message.user .rumi-message-body { background: #e4f0f9 !important; border-color: #c5dceb !important; color: #194463 !important; }
  html[data-theme="light"] .rumi-composer textarea { background: #ffffff !important; border-color: #d4e0e8 !important; color: #24394d !important; }
  html[data-theme="light"] .rumi-composer textarea::placeholder { color: #8b9baa !important; }
  html[data-theme="light"] .rumi-composer button { background: #e5f1f9 !important; border-color: #c3dbe9 !important; color: #18567c !important; }
  html[data-theme="light"] .rumi-status { background: #edf8f2 !important; border-color: #cde8d8 !important; color: #26734d !important; }
  html[data-theme="light"] .rumi-local-pill { background: #edf6fb !important; border-color: #cbdfea !important; color: #23618a !important; }

  html[data-theme="light"] .notifications-filters button { color: #6b7d90 !important; }
  html[data-theme="light"] .notifications-filters button.selected { background: #e9f2f9 !important; border-color: #cfdeea !important; color: #1d567f !important; }
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
  }), [theme]);

  return <ThemeContext.Provider value={value}>
    <style>{lightThemeStyles}</style>
    {children}
  </ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
