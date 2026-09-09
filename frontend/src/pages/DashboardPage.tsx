import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type DashboardProject = {
  id: string;
  name: string;
  contractor_count: number;
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
  if (status === "ready") return "READY";
  if (status === "attention") return "ATTENTION";
  if (status === "not_ready") return "NOT READY";
  return "NOT EVALUATED";
}

function statusClass(status: string | null) {
  if (status === "ready") return "ready";
  if (status === "attention") return "attention";
  if (status === "not_ready") return "not-ready";
  return "not-evaluated";
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api<DashboardData>("/api/dashboard")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load workspace data."))
      .finally(() => setLoading(false));
  }, []);

  const coverage = data.total_project_requirements ? Math.round((data.covered_requirement_count / data.total_project_requirements) * 100) : 0;
  const attentionTotal = data.attention_count + data.not_ready_count;

  return (
    <section className="command-center">
      <div className="command-header">
        <div>
          <p className="dashboard-eyebrow">COMMAND CENTER · {data.company_name.toUpperCase()}</p>
          <h1>Your readiness picture.</h1>
          <p>One operational view of projects, contractors, evidence, and the decisions that need attention.</p>
        </div>
        <div className="dashboard-actions">
          <Link className="dashboard-secondary" to="/notifications">Attention {attentionTotal > 0 ? `(${attentionTotal})` : ""} <span>→</span></Link>
          <Link className="dashboard-primary" to="/projects">+ Create project</Link>
        </div>
      </div>

      {error && <div className="dashboard-error" role="alert">Unable to load the latest workspace data. {error}</div>}

      <div className="readiness-overview">
        <div className="readiness-main">
          <div className="readiness-label">WORKSPACE READINESS</div>
          <div className="readiness-number">{loading ? "—" : data.readiness_score ?? "—"}<span>{data.readiness_score !== null ? "%" : ""}</span></div>
          <p>{data.readiness_score !== null ? "Overall readiness across evaluated contractor/project checks." : "Evaluate a contractor against a project's requirements to establish readiness."}</p>
          <Link to="/readiness">Open readiness →</Link>
        </div>
        <div className="readiness-orbit"><div className="orbit-ring"><div><strong>{loading ? "—" : data.readiness_score ?? "—"}</strong><small>{data.readiness_score !== null ? "READY" : "NO DATA"}</small></div></div></div>
        <div className="readiness-states">
          <div><span className="state-dot ready" /><strong>{data.ready_count}</strong><small>Ready</small></div>
          <div><span className="state-dot attention" /><strong>{data.attention_count}</strong><small>Attention</small></div>
          <div><span className="state-dot not-ready" /><strong>{data.not_ready_count}</strong><small>Not ready</small></div>
        </div>
      </div>

      <div className="dashboard-section-title"><div><span>PRIORITY QUEUE</span><h2>What needs your attention</h2></div><Link to="/notifications">View all →</Link></div>
      <div className="attention-grid">
        <Link className="attention-card" to="/contractors"><span className="attention-icon">!</span><div><strong>{data.not_ready_count} contractors are not ready</strong><p>Review contractors with failed readiness checks.</p></div><b>→</b></Link>
        <Link className="attention-card" to="/evidence"><span className="attention-icon">!</span><div><strong>{data.expiring_count} documents expire soon</strong><p>Evidence with an expiry date inside the next 30 days.</p></div><b>→</b></Link>
        <Link className="attention-card" to="/evidence"><span className="attention-icon">!</span><div><strong>{data.unmapped_count} evidence items are unmapped</strong><p>Connect evidence to the requirements it satisfies.</p></div><b>→</b></Link>
      </div>

      <div className="dashboard-section-title project-title"><div><span>LIVE PORTFOLIO</span><h2>Project readiness</h2></div><Link to="/projects">All projects →</Link></div>
      <article className="dashboard-panel project-panel">
        <div className="project-head"><span>PROJECT</span><span>EVALUATED</span><span>READINESS</span><span>STATUS</span><span /></div>
        {data.projects.length === 0 ? <div className="dashboard-empty">No projects yet. Create your first project to begin the readiness workflow.</div> : data.projects.slice(0, 6).map((project) => <Link className="project-row" to={`/projects/${project.id}`} key={project.id}><span><strong>{project.name}</strong><small>{project.contractor_count} evaluated contractor{project.contractor_count === 1 ? "" : "s"}</small></span><span>{project.contractor_count}</span><strong>{project.readiness_score !== null ? `${project.readiness_score}%` : "—"}</strong><span className={`status-chip ${statusClass(project.readiness_status)}`}>{statusLabel(project.readiness_status)}</span><b>→</b></Link>)}
      </article>

      <div className="dashboard-two-column">
        <article className="dashboard-panel">
          <div className="panel-title"><div><span>EVIDENCE HEALTH</span><h2>Evidence coverage</h2></div><Link to="/evidence">Open →</Link></div>
          <div className="evidence-summary"><strong>{coverage}%</strong><span>of project requirements have mapped active evidence</span></div>
          <div className="coverage-track"><i style={{ width: `${coverage}%` }} /></div>
          <div className="coverage-legend"><span>Evidence <b>{data.evidence_count}</b></span><span>Expiring <b>{data.expiring_count}</b></span><span>Expired <b>{data.expired_count}</b></span><span>Unmapped <b>{data.unmapped_count}</b></span></div>
        </article>
        <article className="dashboard-panel">
          <div className="panel-title"><div><span>WORKSPACE INVENTORY</span><h2>Operational totals</h2></div><Link to="/usage">Usage →</Link></div>
          <div className="inventory-grid"><div><strong>{data.project_count}</strong><small>Projects</small></div><div><strong>{data.contractor_count}</strong><small>Contractors</small></div><div><strong>{data.requirement_count}</strong><small>Requirements</small></div><div><strong>{data.evidence_count}</strong><small>Evidence</small></div></div>
        </article>
      </div>

      <div className="dashboard-two-column lower">
        <article className="dashboard-panel rumi-dashboard"><div className="panel-title"><div><span>AGATA INTELLIGENCE</span><h2>Ask Rumi</h2></div><span className="local-badge">LOCAL AI</span></div><div className="rumi-dashboard-body"><div className="rumi-avatar-large">R</div><div><strong>Ask the workspace.</strong><p>Rumi explains readiness from structured AGATA data while the readiness engine remains the source of truth.</p><div className="rumi-suggestion">Why isn't this contractor ready? <span>→</span></div><Link to="/rumi">Open Rumi →</Link></div></div></article>
        <article className="dashboard-panel activity-panel"><div className="panel-title"><div><span>RECENT ACTIVITY</span><h2>Workspace activity</h2></div><Link to="/audit">Audit trail →</Link></div><div className="activity-list">{data.recent_activity.length === 0 ? <div className="activity-empty">No activity yet. Your workspace activity will appear here as you work.</div> : data.recent_activity.map((activity, index) => <div key={`${activity}-${index}`}><span>RECENT</span><p>{activity}</p></div>)}</div></article>
      </div>

      <div className="dashboard-footer-prompt"><div><span>READY TO BUILD</span><h2>Start with the decision that matters.</h2><p>Create a project, define its requirements, and let AGATA turn evidence into a clear readiness decision.</p></div><Link className="dashboard-primary" to="/projects">Create project →</Link></div>
    </section>
  );
}
