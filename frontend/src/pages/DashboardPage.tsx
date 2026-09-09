import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";

type DashboardProject = { id: string; name: string; contractor_count: number; requirement_count: number; readiness_score: number | null; readiness_status: string | null; updated_at: string | null };
type DashboardActivity = { type: string; title: string; description: string; created_at: string };
type DashboardAttention = { kind: string; title: string; description: string; severity: "high" | "medium" | "low"; href: string };
type DashboardExpiration = { id: string; name: string; contractor_name: string | null; expires_at: string; days_remaining: number };
type DashboardTrendPoint = { month: string; score: number };
type DashboardData = {
  company_name: string; project_count: number; contractor_count: number; requirement_count: number; evidence_count: number;
  readiness_score: number | null; ready_count: number; attention_count: number; not_ready_count: number;
  expiring_count: number; expired_count: number; valid_evidence_count: number; unmapped_count: number;
  covered_requirement_count: number; total_project_requirements: number; projects: DashboardProject[];
  recent_activity: DashboardActivity[]; attention_items: DashboardAttention[]; upcoming_expirations: DashboardExpiration[];
  readiness_trend: DashboardTrendPoint[];
};

type IconName = "folder" | "users" | "file" | "shield" | "clock" | "alert" | "upload" | "check" | "arrow" | "activity";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "folder": return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 11a3 3 0 0 0 0-6" /><path d="M18 14a5 5 0 0 1 2.5 5" /></svg>;
    case "file": return <svg {...common}><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h6" /></svg>;
    case "shield": return <svg {...common}><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
    case "clock": return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>;
    case "alert": return <svg {...common}><path d="M12 4 21 19H3L12 4Z" /><path d="M12 9v4M12 16h.01" /></svg>;
    case "upload": return <svg {...common}><path d="M12 16V4m-5 5 5-5 5 5M5 20h14" /></svg>;
    case "check": return <svg {...common}><path d="m5 12 4 4L19 6" /></svg>;
    case "arrow": return <svg {...common}><path d="M5 12h13m-5-6 6 6-6 6" /></svg>;
    case "activity": return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  }
}

function formatDate(value: string | null) {
  if (!value) return "Not evaluated";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusLabel(status: string | null) {
  if (status === "ready") return "Ready";
  if (status === "attention") return "Attention";
  if (status === "not_ready") return "Not ready";
  return "Not evaluated";
}

function statusClass(status: string | null) {
  if (status === "ready") return "agata-status-ready";
  if (status === "attention") return "agata-status-attention";
  if (status === "not_ready") return "agata-status-not-ready";
  return "agata-status-neutral";
}

function activityIcon(type: string): IconName {
  const value = type.toLowerCase();
  if (value.includes("upload") || value.includes("document")) return "upload";
  if (value.includes("readiness") || value.includes("compliance")) return "shield";
  if (value.includes("requirement")) return "file";
  if (value.includes("contractor")) return "users";
  return "activity";
}

function severityIcon(severity: DashboardAttention["severity"]): IconName {
  return severity === "high" ? "alert" : severity === "medium" ? "clock" : "file";
}

function severityClass(severity: DashboardAttention["severity"]) {
  return severity === "high" ? "attention-red" : severity === "medium" ? "attention-yellow" : "attention-blue";
}

function buildTrendPath(points: DashboardTrendPoint[], width: number, height: number) {
  if (points.length < 2) return "";
  return points.map((point, index) => {
    const x = (index / (points.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, point.score)) / 100) * height;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function EvidenceDonut({ data }: { data: DashboardData }) {
  const total = data.valid_evidence_count + data.expiring_count + data.expired_count + data.unmapped_count;
  if (!total) return <div className="agata-evidence-donut agata-evidence-donut-empty"><div><strong>0</strong><span>Total Evidence</span></div></div>;
  const valid = (data.valid_evidence_count / total) * 100;
  const expiring = (data.expiring_count / total) * 100;
  const expired = (data.expired_count / total) * 100;
  const gradient = `conic-gradient(#35d9a4 0 ${valid}%, #f2c634 ${valid}% ${valid + expiring}%, #ed5d6b ${valid + expiring}% ${valid + expiring + expired}%, #8299b5 ${valid + expiring + expired}% 100%)`;
  return <div className="agata-evidence-donut" style={{ background: gradient }}><div><strong>{data.evidence_count.toLocaleString()}</strong><span>Total Evidence</span></div></div>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<DashboardData>("/api/dashboard")
      .then((response) => { if (active) setData(response); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load the command center."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const firstName = useMemo(() => user?.full_name?.trim().split(/\s+/)[0] || "there", [user]);
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  if (loading) return <div className="agata-dashboard"><div className="agata-dashboard-loading"><div className="agata-loading-orb" /><p>Loading your command center…</p></div></div>;
  if (error || !data) return <div className="agata-dashboard"><section className="agata-dashboard-error"><div className="agata-error-icon"><Icon name="alert" size={22} /></div><div><span className="agata-section-eyebrow">COMMAND CENTER</span><h1>We couldn't load your workspace.</h1><p>{error || "No dashboard data is available."}</p></div></section></div>;

  const readiness = data.readiness_score;
  const totalEvaluations = data.ready_count + data.attention_count + data.not_ready_count;
  const trendPath = buildTrendPath(data.readiness_trend, 520, 118);
  const attentionItems = data.attention_items.slice(0, 5);
  const expirations = data.upcoming_expirations.slice(0, 5);
  const projects = data.projects.slice(0, 6);
  const activity = data.recent_activity.slice(0, 5);
  const coverage = data.total_project_requirements > 0 ? Math.round((data.covered_requirement_count / data.total_project_requirements) * 100) : null;

  return (
    <div className="agata-dashboard">
      <header className="agata-dashboard-header">
        <div><span className="agata-section-eyebrow">COMMAND CENTER · AGATA</span><h1>Welcome back, {firstName}.</h1><p>Here's what's happening with your compliance today.</p></div>
        <div className="agata-dashboard-header-actions"><time>{today}</time><Link to="/readiness" className="agata-secondary-button">Review attention <Icon name="arrow" size={15} /></Link><Link to="/projects" className="agata-primary-button"><span>+</span> New project</Link></div>
      </header>

      <div className="agata-top-stage">
        <div className="agata-top-stage-main">
          <section className="agata-kpi-grid">
            <Link to="/projects" className="agata-kpi-card"><div><span>Total Projects</span><strong>{data.project_count.toLocaleString()}</strong><small>Active workspace projects</small></div><div className="agata-kpi-icon"><Icon name="folder" size={22} /></div></Link>
            <Link to="/contractors" className="agata-kpi-card"><div><span>Total Contractors</span><strong>{data.contractor_count.toLocaleString()}</strong><small>Contractors in workspace</small></div><div className="agata-kpi-icon"><Icon name="users" size={22} /></div></Link>
            <Link to="/requirements" className="agata-kpi-card"><div><span>Total Requirements</span><strong>{data.requirement_count.toLocaleString()}</strong><small>Requirements available</small></div><div className="agata-kpi-icon"><Icon name="file" size={22} /></div></Link>
            <Link to="/evidence" className="agata-kpi-card"><div><span>Total Evidence</span><strong>{data.evidence_count.toLocaleString()}</strong><small>{data.expiring_count} expiring · {data.expired_count} expired</small></div><div className="agata-kpi-icon"><Icon name="shield" size={22} /></div></Link>
          </section>

          <section className="agata-primary-grid">
            <article className="agata-panel agata-readiness-panel">
              <div className="agata-panel-heading"><div><span className="agata-section-eyebrow">READINESS</span><h2>Overall Readiness</h2><p>Across all evaluated projects and contractors.</p></div><Link to="/readiness">Open readiness <Icon name="arrow" size={14} /></Link></div>
              <div className="agata-readiness-content">
                <div className="agata-readiness-ring" style={{ "--readiness": readiness ?? 0 } as CSSProperties}><div className="agata-readiness-ring-inner">{readiness === null ? <><strong>—</strong><span>NO DATA</span></> : <><strong>{Math.round(readiness)}%</strong><span>Overall Readiness</span></>}</div></div>
                <div className="agata-readiness-breakdown">
                  <div><span><i className="dot-ready" />Ready</span><strong>{data.ready_count}</strong>{totalEvaluations > 0 && <small>{Math.round((data.ready_count / totalEvaluations) * 100)}%</small>}</div>
                  <div><span><i className="dot-attention" />Attention</span><strong>{data.attention_count}</strong>{totalEvaluations > 0 && <small>{Math.round((data.attention_count / totalEvaluations) * 100)}%</small>}</div>
                  <div><span><i className="dot-not-ready" />Not ready</span><strong>{data.not_ready_count}</strong>{totalEvaluations > 0 && <small>{Math.round((data.not_ready_count / totalEvaluations) * 100)}%</small>}</div>
                </div>
              </div>
            </article>

            <article className="agata-panel agata-trend-panel">
              <div className="agata-panel-heading"><div><span className="agata-section-eyebrow">PERFORMANCE</span><h2>Readiness Trend</h2><p>Historical readiness movement.</p></div><span className="agata-panel-filter">Last 6 months <span>⌄</span></span></div>
              <div className="agata-trend-chart">
                <div className="agata-trend-grid">{["100%", "75%", "50%", "25%", "0%"].map((label) => <span key={label}>{label}</span>)}</div>
                {data.readiness_trend.length >= 2 ? <svg className="agata-trend-svg" viewBox="0 0 520 118" preserveAspectRatio="none" aria-label="Readiness trend"><path d={trendPath} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{data.readiness_trend.map((point, index) => { const x = (index / (data.readiness_trend.length - 1)) * 520; const y = 118 - (Math.max(0, Math.min(100, point.score)) / 100) * 118; return <circle key={`${point.month}-${index}`} cx={x} cy={y} r="3.5" />; })}</svg> : <div className="agata-trend-empty-message">Historical trend will appear as AGATA records more readiness checks.</div>}
                <div className="agata-trend-labels">{(data.readiness_trend.length ? data.readiness_trend : [{ month: "—", score: 0 }]).map((point, index) => <span key={`${point.month}-${index}`}>{point.month}</span>)}</div>
              </div>
            </article>
          </section>
        </div>

        <aside className="agata-panel agata-rumi-panel">
          <div className="agata-rumi-header"><div className="agata-rumi-avatar">R</div><div><h2>Rumi</h2><p>Your compliance assistant</p></div></div>
          <div className="agata-rumi-message">{attentionItems.length ? `${attentionItems.length} compliance item${attentionItems.length === 1 ? " requires" : "s require"} attention. Would you like to review them?` : "Your workspace has no current attention items."}</div>
          <Link to={attentionItems.length ? (attentionItems[0].href || "/readiness") : "/rumi"} className="agata-rumi-action">{attentionItems.length ? "Show attention items" : "Review with Rumi"} <Icon name="arrow" size={14} /></Link>
          <div className="agata-rumi-prompts"><Link to="/readiness"><span>○</span> Which contractors are not ready?</Link><Link to="/evidence"><span>○</span> Show expiring evidence this month</Link><Link to="/readiness"><span>◷</span> Give me a readiness summary</Link></div>
        </aside>
      </div>

      <section className="agata-secondary-grid">
        <article className="agata-panel agata-projects-panel">
          <div className="agata-panel-heading"><div><h2>Projects at a Glance</h2><p>Your projects and their current readiness status.</p></div><div className="agata-heading-actions"><Link to="/projects">View all</Link><Link to="/projects" className="agata-primary-button">+ New project</Link></div></div>
          <div className="agata-project-table-wrap">
            {projects.length ? <table className="agata-project-table"><thead><tr><th>Project</th><th>Contractors</th><th>Requirements</th><th>Readiness</th><th>Status</th><th>Last updated</th><th aria-label="Actions" /></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><td><Link to={`/projects/${project.id}`}>{project.name}</Link></td><td>{project.contractor_count}</td><td>{project.requirement_count}</td><td className={project.readiness_score === null ? "muted" : ""}>{project.readiness_score === null ? "—" : `${Math.round(project.readiness_score)}%`}</td><td><span className={`agata-status-pill ${statusClass(project.readiness_status)}`}><i />{statusLabel(project.readiness_status)}</span></td><td>{formatDate(project.updated_at)}</td><td className="row-menu">⋮</td></tr>)}</tbody></table> : <div className="agata-empty-table"><Icon name="folder" size={22} /><strong>No projects yet</strong><span>Create a project to start tracking contractor readiness.</span><Link to="/projects" className="agata-primary-button">Create your first project</Link></div>}
          </div>
        </article>

        <article className="agata-panel agata-attention-panel">
          <div className="agata-panel-heading"><h2>Needs Attention</h2><Link to="/readiness">View all</Link></div>
          <div className="agata-attention-list">{attentionItems.length ? attentionItems.map((item) => <Link to={item.href || "/readiness"} className="agata-attention-item" key={`${item.kind}-${item.title}`}><span className={`attention-icon ${severityClass(item.severity)}`}><Icon name={severityIcon(item.severity)} size={16} /></span><span className="attention-copy"><strong>{item.title}</strong><small>{item.description}</small></span><b>{item.severity === "high" ? "Action" : item.severity === "medium" ? "Review" : "View"}</b></Link>) : <div className="agata-attention-empty"><span><Icon name="check" size={18} /></span><strong>Nothing needs attention</strong><p>AGATA will surface missing, expiring, or incomplete evidence here.</p></div>}</div>
        </article>
      </section>

      <section className="agata-bottom-grid">
        <article className="agata-panel agata-activity-panel">
          <div className="agata-panel-heading"><h2>Recent Activity</h2><Link to="/audit">View all</Link></div>
          <div className="agata-activity-list">{activity.length ? activity.map((item, index) => <div className="agata-activity-item" key={`${item.created_at}-${index}`}><span className="activity-icon"><Icon name={activityIcon(item.type)} size={16} /></span><span><strong>{item.title}</strong><small>{item.description}</small></span><time>{relativeTime(item.created_at)}</time></div>) : <div className="agata-activity-empty"><Icon name="activity" size={20} /><span>Activity will appear as your team works in AGATA.</span></div>}</div>
        </article>

        <article className="agata-panel agata-evidence-panel">
          <div className="agata-panel-heading"><h2>Evidence Status</h2><Link to="/evidence">View all</Link></div>
          <div className="agata-evidence-content"><EvidenceDonut data={data} /><div className="agata-evidence-legend"><div><span><i className="dot-ready" />Valid</span><strong>{data.valid_evidence_count}</strong></div><div><span><i className="dot-attention" />Expiring</span><strong>{data.expiring_count}</strong></div><div><span><i className="dot-not-ready" />Expired</span><strong>{data.expired_count}</strong></div><div><span><i className="dot-muted" />Unmapped</span><strong>{data.unmapped_count}</strong></div>{coverage !== null && <small>{coverage}% of project requirements have mapped evidence.</small>}</div></div>
        </article>

        <article className="agata-panel agata-expiration-panel">
          <div className="agata-panel-heading"><h2>Upcoming Expirations</h2><Link to="/evidence">View all</Link></div>
          <div className="agata-expiration-list">{expirations.length ? expirations.map((item) => <Link to={`/evidence/${item.id}`} className="agata-expiration-item" key={item.id}><span className="expiration-icon"><Icon name={item.days_remaining <= 14 ? "alert" : "clock"} size={15} /></span><span><strong>{item.name}</strong><small>{item.contractor_name || "Workspace evidence"}</small></span><b>{item.days_remaining} days</b></Link>) : <div className="agata-expiration-empty"><Icon name="check" size={18} /><span>No upcoming expirations.</span></div>}</div>
        </article>
      </section>

      <footer className="agata-dashboard-footer"><span>AGATA keeps readiness explainable.</span><span>{data.company_name} · {data.evidence_count.toLocaleString()} evidence records · {data.project_count} projects</span></footer>
    </div>
  );
}
