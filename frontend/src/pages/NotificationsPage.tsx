import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type NotificationItem = {
  id: string;
  kind: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  status: "active" | "resolved";
  read_at: string | null;
  created_at: string;
};

type Filter = "all" | "unread" | "critical" | "warning" | "info" | "resolved";

function Icon({ name, size = 18 }: { name: "bell" | "alert" | "warning" | "info" | "check" | "arrow" | "close" | "search"; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "bell") return <svg {...c}><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if (name === "alert") return <svg {...c}><path d="m12 4 9 16H3L12 4Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  if (name === "warning") return <svg {...c}><path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  if (name === "info") return <svg {...c}><circle cx="12" cy="12" r="8.5"/><path d="M12 10.5v5"/><path d="M12 7.5h.01"/></svg>;
  if (name === "check") return <svg {...c}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "arrow") return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
  if (name === "close") return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
  return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function severityLabel(value: NotificationItem["severity"]) {
  if (value === "critical") return "Critical";
  if (value === "warning") return "Warning";
  return "Info";
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const data = await api<NotificationItem[]>("/api/notifications?status=all");
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    all: items.filter((item) => item.status === "active").length,
    unread: items.filter((item) => item.status === "active" && !item.read_at).length,
    critical: items.filter((item) => item.status === "active" && item.severity === "critical").length,
    warning: items.filter((item) => item.status === "active" && item.severity === "warning").length,
    info: items.filter((item) => item.status === "active" && item.severity === "info").length,
    resolved: items.filter((item) => item.status === "resolved").length,
  }), [items]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "resolved" ? item.status !== "resolved" : item.status !== "active") return false;
      if (filter === "unread" && item.read_at) return false;
      if (["critical", "warning", "info"].includes(filter) && item.severity !== filter) return false;
      return !value || `${item.title} ${item.description} ${item.kind}`.toLowerCase().includes(value);
    });
  }, [items, filter, query]);

  async function markRead(id: string) {
    try {
      setSavingId(id);
      setError("");
      const updated = await api<NotificationItem>(`/api/notifications/${id}/read`, { method: "PATCH" });
      setItems((current) => current.map((item) => item.id === id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update notification.");
    } finally {
      setSavingId("");
    }
  }

  async function markAllRead() {
    try {
      setSavingId("all");
      setError("");
      await api("/api/notifications/read-all", { method: "POST" });
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => item.status === "active" ? { ...item, read_at: item.read_at ?? now } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark notifications as read.");
    } finally {
      setSavingId("");
    }
  }

  return <>
    <style>{styles}</style>
    <section className="notifications-page">
      <header className="notifications-header">
        <div>
          <span className="notifications-eyebrow">WORK · NOTIFICATIONS</span>
          <h1>Notifications</h1>
          <p>Stay ahead of evidence and readiness issues that need action in your workspace.</p>
        </div>
        {counts.unread > 0 && <button className="notifications-mark-all" type="button" onClick={() => void markAllRead()} disabled={savingId === "all"}><Icon name="check" size={15}/> Mark all read</button>}
      </header>

      {error && <div className="notifications-error" role="alert"><Icon name="alert" size={15}/><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss error"><Icon name="close" size={14}/></button></div>}

      <section className="notifications-overview">
        <div className="notifications-stat"><span>Needs attention</span><strong>{counts.all}</strong><small>active items</small></div>
        <div className="notifications-stat"><span>Unread</span><strong>{counts.unread}</strong><small>not reviewed</small></div>
        <div className="notifications-stat critical"><span>Critical</span><strong>{counts.critical}</strong><small>action required</small></div>
        <div className="notifications-stat warning"><span>Warnings</span><strong>{counts.warning}</strong><small>review soon</small></div>
      </section>

      <section className="notifications-toolbar">
        <label className="notifications-search"><Icon name="search" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notifications" aria-label="Search notifications"/></label>
        <div className="notifications-filters" role="tablist" aria-label="Notification filters">
          {(["all", "unread", "critical", "warning", "info", "resolved"] as Filter[]).map((value) => <button key={value} type="button" className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value === "all" ? "All active" : value === "unread" ? "Unread" : value[0].toUpperCase() + value.slice(1)}<span>{counts[value]}</span></button>)}
        </div>
      </section>

      <section className="notifications-panel">
        <div className="notifications-panel-head"><div><span className="notifications-eyebrow">OPERATIONAL FEED</span><h2>{filter === "resolved" ? "Resolved" : "Current attention"}</h2></div><span>{filtered.length} {filtered.length === 1 ? "item" : "items"}</span></div>
        {loading ? <div className="notifications-empty"><div className="notifications-spinner"/><strong>Checking your workspace…</strong><span>AGATA is evaluating current evidence and readiness signals.</span></div> : filtered.length === 0 ? <div className="notifications-empty"><div className="notifications-empty-icon"><Icon name={filter === "resolved" ? "check" : "bell"} size={22}/></div><strong>{filter === "resolved" ? "No resolved notifications" : "You're clear for now"}</strong><span>{filter === "resolved" ? "Resolved operational items will appear here." : query ? "No notifications match your search." : "AGATA has no active operational items in this workspace."}</span></div> : <div className="notifications-list">{filtered.map((item) => <article className={`notification-row ${item.read_at ? "read" : "unread"} ${item.severity}`} key={item.id}>
          <div className={`notification-icon ${item.severity}`}><Icon name={item.severity === "critical" ? "alert" : item.severity === "warning" ? "warning" : item.status === "resolved" ? "check" : "info"} size={17}/></div>
          <div className="notification-content"><div className="notification-meta"><span className={`notification-severity ${item.severity}`}>{severityLabel(item.severity)}</span>{item.status === "resolved" && <span className="notification-resolved">Resolved</span>}<time>{timeLabel(item.created_at)}</time></div><h3>{item.title}</h3><p>{item.description}</p><div className="notification-actions">{item.status === "active" && !item.read_at && <button type="button" onClick={() => void markRead(item.id)} disabled={savingId === item.id}><Icon name="check" size={14}/> Mark read</button>}<button type="button" onClick={() => navigate(item.href)}>{item.kind.startsWith("readiness") ? "Open readiness" : "Open evidence"}<Icon name="arrow" size={14}/></button></div></div>
          {!item.read_at && item.status === "active" && <span className="notification-dot" aria-label="Unread"/>}
        </article>)}</div>}
      </section>

      <footer className="notifications-footer"><div><span className="notifications-eyebrow">THE AGATA NOTIFICATION MODEL</span><h2>Signals, not noise.</h2><p>Notifications are generated from live workspace conditions: evidence expiry, evidence mapping gaps, and contractor readiness. When the underlying issue is resolved, the notification is resolved too.</p></div><div className="notifications-footer-grid"><span><strong>Evidence</strong>Expiry & mapping</span><span><strong>Readiness</strong>Project decisions</span><span><strong>State</strong>Active & resolved</span></div></footer>
    </section>
  </>;
}

const styles = `
.notifications-page{max-width:1180px;margin:0 auto;padding:34px 0 56px;color:#e8eef8}.notifications-header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:26px}.notifications-eyebrow{display:block;font-size:10px;font-weight:800;letter-spacing:.16em;color:#73839a}.notifications-header h1{margin:7px 0 8px;font-size:34px;letter-spacing:-.04em}.notifications-header p{margin:0;color:#8392a7;font-size:14px;line-height:1.6}.notifications-mark-all{display:inline-flex;align-items:center;gap:8px;border:1px solid #25354a;background:#111b29;color:#dce8f7;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer}.notifications-mark-all:hover{background:#172335}.notifications-error{display:flex;align-items:center;gap:9px;border:1px solid #5a2930;background:#21171b;color:#ffb9c0;border-radius:10px;padding:11px 13px;margin-bottom:18px;font-size:13px}.notifications-error button{margin-left:auto;border:0;background:transparent;color:inherit;cursor:pointer}.notifications-overview{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}.notifications-stat{background:linear-gradient(180deg,#111b28,#0d1520);border:1px solid #1d2b3d;border-radius:14px;padding:17px 18px}.notifications-stat span{display:block;color:#8c9caf;font-size:11px;font-weight:700}.notifications-stat strong{display:block;font-size:28px;letter-spacing:-.04em;margin-top:6px}.notifications-stat small{display:block;color:#5f7188;font-size:11px;margin-top:3px}.notifications-stat.critical strong{color:#ff8e99}.notifications-stat.warning strong{color:#e7b86d}.notifications-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.notifications-search{height:42px;min-width:260px;display:flex;align-items:center;gap:9px;padding:0 12px;background:#0c141f;border:1px solid #1c2a3b;border-radius:10px;color:#63758c}.notifications-search input{width:100%;border:0;outline:0;background:transparent;color:#e8eef8;font:inherit;font-size:13px}.notifications-filters{display:flex;gap:5px;flex-wrap:wrap}.notifications-filters button{display:inline-flex;align-items:center;gap:7px;border:1px solid transparent;background:transparent;color:#718198;border-radius:8px;padding:8px 9px;font-size:11px;font-weight:700;cursor:pointer}.notifications-filters button:hover{color:#b8c7d9;background:#101a27}.notifications-filters button.selected{color:#dce8f7;background:#152235;border-color:#24364c}.notifications-filters button span{font-size:10px;color:#667990}.notifications-panel{background:#0b131e;border:1px solid #1b293a;border-radius:16px;overflow:hidden}.notifications-panel-head{display:flex;justify-content:space-between;align-items:center;padding:20px 21px;border-bottom:1px solid #182535}.notifications-panel-head h2{margin:6px 0 0;font-size:17px;letter-spacing:-.02em}.notifications-panel-head>span{color:#64758b;font-size:11px}.notifications-list{display:flex;flex-direction:column}.notification-row{position:relative;display:flex;gap:14px;padding:19px 21px;border-bottom:1px solid #152231;transition:background .16s}.notification-row:last-child{border-bottom:0}.notification-row:hover{background:#0f1925}.notification-row.read{opacity:.72}.notification-icon{width:36px;height:36px;flex:0 0 36px;border-radius:10px;display:grid;place-items:center;background:#172233;color:#8ea1b9}.notification-icon.critical{background:#2a181c;color:#ff8f9a}.notification-icon.warning{background:#2a2116;color:#e7b86d}.notification-icon.info{background:#172434;color:#83b9ee}.notification-content{min-width:0;flex:1}.notification-meta{display:flex;align-items:center;gap:8px;margin-bottom:5px}.notification-meta time{color:#596b82;font-size:10px;margin-left:auto}.notification-severity,.notification-resolved{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.notification-severity.critical{color:#ff8f9a}.notification-severity.warning{color:#e7b86d}.notification-severity.info{color:#83b9ee}.notification-resolved{color:#76b894}.notification-content h3{margin:0 0 5px;font-size:14px;color:#e2eaf4}.notification-content p{margin:0;max-width:760px;color:#7e8da2;font-size:12px;line-height:1.6}.notification-actions{display:flex;gap:8px;margin-top:12px}.notification-actions button{display:inline-flex;align-items:center;gap:6px;border:1px solid #203148;background:#101b29;color:#a9bbd0;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:700;cursor:pointer}.notification-actions button:hover{color:#e3edf9;background:#162437}.notification-actions button:disabled{opacity:.5;cursor:wait}.notification-dot{position:absolute;top:24px;right:21px;width:6px;height:6px;border-radius:50%;background:#69aef0}.notifications-empty{min-height:270px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;color:#73839a}.notifications-empty strong{margin-top:13px;color:#cdd8e6;font-size:14px}.notifications-empty>span{margin-top:6px;font-size:12px;max-width:410px;line-height:1.6}.notifications-empty-icon{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#111d2b;border:1px solid #213249;color:#6f849d}.notifications-spinner{width:24px;height:24px;border:2px solid #24354a;border-top-color:#84b9ef;border-radius:50%;animation:notification-spin .8s linear infinite}@keyframes notification-spin{to{transform:rotate(360deg)}}.notifications-footer{display:grid;grid-template-columns:1.25fr .75fr;gap:30px;margin-top:18px;padding:22px;border:1px solid #1a2838;border-radius:16px;background:linear-gradient(180deg,#0f1823,#0b131d)}.notifications-footer h2{margin:7px 0 7px;font-size:17px}.notifications-footer p{margin:0;color:#718198;font-size:12px;line-height:1.7;max-width:680px}.notifications-footer-grid{display:grid;grid-template-columns:1fr;gap:8px}.notifications-footer-grid span{display:flex;flex-direction:column;padding:10px 12px;border:1px solid #182738;border-radius:9px;background:#0c1520;color:#667990;font-size:10px}.notifications-footer-grid strong{color:#a9bad0;font-size:11px;margin-bottom:2px}
@media(max-width:900px){.notifications-page{padding:24px 0 42px}.notifications-overview{grid-template-columns:repeat(2,minmax(0,1fr))}.notifications-toolbar{align-items:stretch;flex-direction:column}.notifications-search{width:auto}.notifications-footer{grid-template-columns:1fr}}
@media(max-width:600px){.notifications-header{align-items:flex-start;flex-direction:column}.notifications-header h1{font-size:29px}.notifications-overview{grid-template-columns:1fr 1fr}.notifications-stat{padding:14px}.notifications-filters{overflow:auto;flex-wrap:nowrap}.notification-row{padding:16px}.notification-meta time{display:none}.notification-dot{right:15px}.notifications-panel-head{padding:17px}.notifications-footer{padding:17px}.notifications-stat strong{font-size:24px}}
`;
