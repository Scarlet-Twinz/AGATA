import { CSSProperties, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type DashboardProject = {
  id: string;
  name: string;
  contractor_count: number;
  requirement_count: number;
  readiness_score: number | null;
  readiness_status: string | null;
};

type DashboardData = {
  company_name: string;
  project_count: number;
  contractor_count: number;
  requirement_count: number;
  evidence_count: number;
  readiness_score: number | null;
  ready_count: number;
  attention_count: number;
  not_ready_count: number;
  expiring_count: number;
  expired_count: number;
  unmapped_count: number;
  covered_requirement_count: number;
  total_project_requirements: number;
  projects: DashboardProject[];
  recent_activity: string[];
};

const emptyDashboard: DashboardData = {
  company_name: "Workspace",
  project_count: 0,
  contractor_count: 0,
  requirement_count: 0,
  evidence_count: 0,
  readiness_score: null,
  ready_count: 0,
  attention_count: 0,
  not_ready_count: 0,
  expiring_count: 0,
  expired_count: 0,
  unmapped_count: 0,
  covered_requirement_count: 0,
  total_project_requirements: 0,
  projects: [],
  recent_activity: [],
};

function statusLabel(status: string | null) {
  if (status === "ready") return "Ready";
  if (status === "attention") return "Attention";
  if (status === "not_ready") return "Not ready";
  return "Not evaluated";
}

function statusClass(status: string | null) {
  if (status === "ready") return "ready";
  if (status === "attention") return "attention";
  if (status === "not_ready") return "not-ready";
  return "not-evaluated";
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load workspace data."))
      .finally(() => setLoading(false));
  }, []);

  const evaluatedCount = data.ready_count + data.attention_count + data.not_ready_count;
  const coverage = data.total_project_requirements ? Math.round((data.covered_requirement_count / data.total_project_requirements) * 100) : 0;
  const mappedEvidence = Math.max(data.evidence_count - data.unmapped_count, 0);
  const readinessScore = data.readiness_score === null ? null : Math.round(data.readiness_score);
  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const today = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()), []);

  return (
    <section className="command-center">
      <div className="command-header">
        <div>
          <p className="dashboard-eyebrow">COMMAND CENTER · {data.company_name.toUpperCase()}</p>
          <h1>Welcome back, {firstName}.</h1>
          <p>Here's what's happening with your compliance today.</p>
        </div>
        <div className="command-header-meta">
          <span>{today}</span>
          <div className="dashboard-actions">
            <Link className="dashboard-secondary" to="/notifications">Review attention{data.attention_count + data.not_ready_count > 0 ? ` (${data.attention_count + data.not_ready_count})` : ""} <span>→</span></Link>
            <Link className="dashboard-primary" to="/projects">+ New project</Link>
          </div>
        </div>
      </div>

      {error && <div className="dashboard-error" role="alert">Unable to load the latest workspace data. {error}</div>}

      <div className="dashboard-kpis">
        <Link to="/projects" className="dashboard-kpi"><span>Total Projects</span><strong>{loading ? "—" : data.project_count}</strong><small>Active workspace projects</small><i>◈</i></Link>
        <Link to="/contractors" className="dashboard-kpi"><span>Total Contractors</span><strong>{loading ? "—" : data.contractor_count}</strong><small>Contractors in workspace</small><i>◎</i></Link>
        <Link to="/requirements" className="dashboard-kpi"><span>Total Requirements</span><strong>{loading ? "—" : data.requirement_count}</strong><small>Requirements available</small><i>≡</i></Link>
        <Link to="/evidence" className="dashboard-kpi"><span>Total Evidence</span><strong>{loading ? "—" : data.evidence_count}</strong><small>{data.expiring_count} expiring · {data.expired_count} expired</small><i>◇</i></Link>
      </div>

      <div className="dashboard-hero-grid">
        <article className="dashboard-surface readiness-card">
          <div className="surface-heading"><div><span>READINESS</span><h2>Overall readiness</h2><p>Across evaluated contractor and project checks.</p></div><Link to="/readiness">Open readiness →</Link></div>
          <div className="readiness-visual">
            <div className="readiness-gauge" style={{ "--readiness": `${readinessScore ?? 0}%` } as CSSProperties}><div><strong>{loading ? "—" : readinessScore === null ? "—" : `${readinessScore}%`}</strong><small>{readinessScore === null ? "NO DATA" : "READINESS"}</small></div></div>
            <div className="readiness-breakdown">
              <div><span className="legend-dot ready" /><b>Ready</b><strong>{data.ready_count}</strong>{evaluatedCount > 0 && <small>{Math.round((data.ready_count / evaluatedCount) * 100)}%</small>}</div>
              <div><span className="legend-dot attention" /><b>Attention</b><strong>{data.attention_count}</strong>{evaluatedCount > 0 && <small>{Math.round((data.attention_count / evaluatedCount) * 100)}%</small>}</div>
              <div><span className="legend-dot not-ready" /><b>Not ready</b><strong>{data.not_ready_count}</strong>{evaluatedCount > 0 && <small>{Math.round((data.not_ready_count / evaluatedCount) * 100)}%</small>}</div>
            </div>
          </div>
        </article>

        <article className="dashboard-surface rumi-card">
          <div className="rumi-card-head"><div className="rumi-avatar-large">R</div><div><h2>Rumi</h2><p>Your compliance assistant</p></div></div>
          <div className="rumi-message">{data.not_ready_count > 0 ? `${data.not_ready_count} contractor${data.not_ready_count === 1 ? " requires" : "s require"} attention right now. Would you like to review them?` : data.expiring_count > 0 ? `${data.expiring_count} evidence item${data.expiring_count === 1 ? " is" : "s are"} approaching expiry.` : "Your workspace has no current attention items."}</div>
          <Link className="rumi-primary" to={data.not_ready_count > 0 ? "/readiness" : "/evidence"}>{data.not_ready_count > 0 ? "Show attention items" : "Review evidence"} →</Link>
          <div className="rumi-prompts"><Link to="/readiness">◉ Which contractors are not ready?</Link><Link to="/evidence">◷ Show expiring evidence</Link><Link to="/rumi">↗ Give me a readiness summary</Link></div>
        </article>
      </div>

      <div className="dashboard-section-title"><div><span>WORK QUEUE</span><h2>Needs attention</h2><p>Signals generated from current workspace data.</p></div><Link to="/notifications">View all →</Link></div>
      <div className="attention-grid attention-grid-wide">
        <Link className="attention-card" to="/readiness"><span className="attention-icon danger">!</span><div><strong>{data.not_ready_count} contractor{data.not_ready_count === 1 ? " is" : "s are"} not ready</strong><p>Review failed or incomplete readiness checks.</p></div><b>→</b></Link>
        <Link className="attention-card" to="/evidence"><span className="attention-icon warning">◷</span><div><strong>{data.expiring_count} evidence item{data.expiring_count === 1 ? " expires" : "s expire"} soon</strong><p>Evidence with an expiry date inside the current attention window.</p></div><b>→</b></Link>
        <Link className="attention-card" to="/evidence"><span className="attention-icon info">◇</span><div><strong>{data.unmapped_count} evidence item{data.unmapped_count === 1 ? " is" : "s are"} unmapped</strong><p>Connect evidence to the requirement it satisfies.</p></div><b>→</b></Link>
      </div>

      <div className="dashboard-section-title project-title"><div><span>PORTFOLIO</span><h2>Projects at a glance</h2><p>Your projects and their current readiness status.</p></div><Link to="/projects">View all →</Link></div>
      <article className="dashboard-surface project-panel">
        <div className="project-head"><span>PROJECT</span><span>CONTRACTORS</span><span>REQUIREMENTS</span><span>READINESS</span><span>STATUS</span><span /></div>
        {data.projects.length === 0 ? <div className="dashboard-empty">No projects yet. Create your first project to begin the readiness workflow.</div> : data.projects.slice(0, 6).map((project) => (
          <Link className="project-row" to={`/projects/${project.id}`} key={project.id}>
            <span><strong>{project.name}</strong><small>{project.contractor_count} evaluated contractor{project.contractor_count === 1 ? "" : "s"}</small></span>
            <span>{project.contractor_count}</span>
            <span>{project.requirement_count}</span>
            <strong>{project.readiness_score !== null ? `${Math.round(project.readiness_score)}%` : "—"}</strong>
            <span className={`status-chip ${statusClass(project.readiness_status)}`}>{statusLabel(project.readiness_status)}</span>
            <b>→</b>
          </Link>
        ))}
      </article>

      <div className="dashboard-two-column dashboard-bottom-grid">
        <article className="dashboard-surface evidence-card">
          <div className="surface-heading"><div><span>EVIDENCE HEALTH</span><h2>Evidence status</h2><p>Coverage against project requirements.</p></div><Link to="/evidence">View all →</Link></div>
          <div className="evidence-status-body">
            <div className="evidence-donut" style={{ "--coverage": `${coverage}%` } as CSSProperties}><div><strong>{coverage}%</strong><small>covered</small></div></div>
            <div className="evidence-legend"><div><span className="legend-dot ready" /><b>Mapped</b><strong>{mappedEvidence}</strong></div><div><span className="legend-dot attention" /><b>Expiring</b><strong>{data.expiring_count}</strong></div><div><span className="legend-dot not-ready" /><b>Expired</b><strong>{data.expired_count}</strong></div><div><span className="legend-dot missing" /><b>Unmapped</b><strong>{data.unmapped_count}</strong></div></div>
          </div>
        </article>

        <article className="dashboard-surface activity-panel">
          <div className="surface-heading"><div><span>WORKSPACE ACTIVITY</span><h2>Recent activity</h2><p>Latest evidence and readiness events.</p></div><Link to="/audit">View all →</Link></div>
          <div className="activity-list">{data.recent_activity.length === 0 ? <div className="activity-empty">No activity yet. Workspace events will appear here as you work.</div> : data.recent_activity.slice(0, 5).map((activity, index) => <div key={`${activity}-${index}`}><span>{index === 0 ? "NOW" : "RECENT"}</span><p>{activity}</p></div>)}</div>
        </article>
      </div>

      <div className="dashboard-footer-prompt"><div><span>AGATA WORKFLOW</span><h2>Turn evidence into a clear decision.</h2><p>Create a project, define its requirements, connect contractor evidence, and let the readiness engine explain the result.</p></div><Link className="dashboard-primary" to="/projects">Start with a project →</Link></div>
    </section>
  );
}
