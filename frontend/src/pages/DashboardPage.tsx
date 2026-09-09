import { Link } from "react-router-dom";

const readiness = [
  ["Ready", "0", "All required evidence is valid"],
  ["Attention", "0", "Nothing currently needs review"],
  ["Not ready", "0", "No blocked contractors yet"],
];

const projects = [
  ["No active projects", "Create your first project to start measuring readiness.", "—"],
];

export function DashboardPage() {
  return (
    <section className="command-center">
      <div className="command-header"><div><p className="dashboard-eyebrow">COMMAND CENTER · AGATA</p><h1>Your readiness picture.</h1><p>One operational view of projects, contractors, evidence, and the decisions that need attention.</p></div><Link className="dashboard-primary" to="/projects">+ Create project</Link></div>

      <div className="readiness-overview">
        <div className="readiness-main"><div className="readiness-label">WORKSPACE READINESS</div><div className="readiness-number">—<span>%</span></div><p>No projects have been evaluated yet. Build your first readiness workflow to establish the baseline.</p><Link to="/projects">Start with a project →</Link></div>
        <div className="readiness-states">{readiness.map(([label,value,note]) => <div className="readiness-state" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></div>)}</div>
      </div>

      <div className="dashboard-section-title"><div><span>Operational view</span><h2>What is happening in your workspace</h2></div><Link to="/notifications">View attention →</Link></div>
      <div className="dashboard-stat-grid"><article><span>PROJECTS</span><strong>0</strong><small>Active projects</small></article><article><span>CONTRACTORS</span><strong>0</strong><small>Contractor profiles</small></article><article><span>EVIDENCE</span><strong>0</strong><small>Evidence items</small></article><article className="attention-stat"><span>ATTENTION</span><strong>0</strong><small>Nothing needs attention</small></article></div>

      <div className="dashboard-two-column"><article className="dashboard-panel"><div className="panel-title"><div><span>PROJECT READINESS</span><h2>Active projects</h2></div><Link to="/projects">All projects →</Link></div><div className="empty-dashboard"><div className="empty-mark">+</div><strong>No active projects yet</strong><p>Projects are where AGATA turns requirements and evidence into a readiness decision.</p><Link to="/projects">Create your first project</Link></div></article><article className="dashboard-panel"><div className="panel-title"><div><span>ATTENTION CENTER</span><h2>Needs attention</h2></div><Link to="/notifications">View all →</Link></div><div className="empty-dashboard compact"><div className="attention-ring">✓</div><strong>You're clear for now</strong><p>When evidence expires, requirements go uncovered, or a contractor becomes blocked, AGATA will surface it here.</p></div></article></div>

      <div className="dashboard-two-column lower"><article className="dashboard-panel"><div className="panel-title"><div><span>EVIDENCE HEALTH</span><h2>Evidence coverage</h2></div><Link to="/evidence">Open evidence →</Link></div><div className="coverage-row"><div><strong>0%</strong><span>requirements currently covered</span></div><div className="coverage-track"><i /></div></div><div className="coverage-legend"><span>Valid <b>0</b></span><span>Expiring <b>0</b></span><span>Expired <b>0</b></span><span>Unmapped <b>0</b></span></div></article><article className="dashboard-panel rumi-dashboard"><div className="panel-title"><div><span>AGATA INTELLIGENCE</span><h2>Rumi</h2></div><Link to="/rumi">Open Rumi →</Link></div><div className="rumi-dashboard-body"><div className="rumi-avatar-large">R</div><div><strong>Ask the workspace.</strong><p>Rumi can explain readiness and help you understand what needs attention, while AGATA's readiness engine remains the source of truth.</p><Link to="/rumi">Ask Rumi a question →</Link></div></div></article></div>

      <div className="dashboard-footer-prompt"><div><span>READY TO BUILD</span><h2>Start with the decision that matters.</h2><p>Create a project, define its requirements, and let AGATA show you what readiness looks like.</p></div><Link className="dashboard-primary" to="/projects">Create your first project →</Link></div>
    </section>
  );
}
