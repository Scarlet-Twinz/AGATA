import { Link } from "react-router-dom";

const attention = [
  ["3 contractors are not ready", "Missing or invalid evidence needs review.", "/contractors"],
  ["7 documents expire soon", "Review evidence expiring within 30 days.", "/evidence"],
  ["2 requirements are uncovered", "Evidence needs to be mapped before work can move forward.", "/requirements"],
];

const projects = [
  ["Infrastructure Upgrade", "12 contractors", "96%", "READY", "ready"],
  ["Building Expansion", "8 contractors", "81%", "ATTENTION", "attention"],
  ["Maintenance Contract", "21 contractors", "42%", "NOT READY", "not-ready"],
];

export function DashboardPage() {
  return (
    <section className="command-center">
      <div className="command-header"><div><p className="dashboard-eyebrow">COMMAND CENTER · AGATA</p><h1>Your readiness picture.</h1><p>One operational view of projects, contractors, evidence, and the decisions that need attention.</p></div><div className="dashboard-actions"><Link className="dashboard-secondary" to="/notifications">Attention <span>→</span></Link><Link className="dashboard-primary" to="/projects">+ Create project</Link></div></div>

      <div className="readiness-overview"><div className="readiness-main"><div className="readiness-label">WORKSPACE READINESS</div><div className="readiness-number">91<span>%</span></div><p>Overall readiness across active projects.</p><Link to="/readiness">Open readiness →</Link></div><div className="readiness-orbit"><div className="orbit-ring"><div><strong>91</strong><small>READY</small></div></div></div><div className="readiness-states"><div><span className="state-dot ready" /><strong>38</strong><small>Ready</small></div><div><span className="state-dot attention" /><strong>7</strong><small>Attention</small></div><div><span className="state-dot not-ready" /><strong>3</strong><small>Not ready</small></div></div></div>

      <div className="dashboard-section-title"><div><span>PRIORITY QUEUE</span><h2>What needs your attention</h2></div><Link to="/notifications">View all →</Link></div>
      <div className="attention-grid">{attention.map(([title, description, to]) => <Link className="attention-card" to={to} key={title}><span className="attention-icon">!</span><div><strong>{title}</strong><p>{description}</p></div><b>→</b></Link>)}</div>

      <div className="dashboard-section-title project-title"><div><span>LIVE PORTFOLIO</span><h2>Project readiness</h2></div><Link to="/projects">All projects →</Link></div>
      <article className="dashboard-panel project-panel"><div className="project-head"><span>PROJECT</span><span>CONTRACTORS</span><span>COVERAGE</span><span>STATUS</span><span /></div>{projects.map(([name, contractors, score, status, tone]) => <Link className="project-row" to="/projects" key={name}><span><strong>{name}</strong><small>{contractors}</small></span><span>{contractors}</span><strong>{score}</strong><span className={`status-chip ${tone}`}>{status}</span><b>→</b></Link>)}</article>

      <div className="dashboard-two-column"><article className="dashboard-panel"><div className="panel-title"><div><span>EVIDENCE HEALTH</span><h2>Evidence coverage</h2></div><Link to="/evidence">Open →</Link></div><div className="evidence-summary"><strong>94%</strong><span>of active requirements have valid evidence</span></div><div className="coverage-track"><i style={{ width: "94%" }} /></div><div className="coverage-legend"><span>Valid <b>218</b></span><span>Expiring <b>17</b></span><span>Expired <b>8</b></span><span>Unmapped <b>4</b></span></div></article><article className="dashboard-panel"><div className="panel-title"><div><span>CONTRACTORS</span><h2>Readiness distribution</h2></div><Link to="/contractors">Manage →</Link></div><div className="contractor-summary"><div className="contractor-total"><strong>48</strong><small>Total contractors</small></div><div className="contractor-bars"><div><span>Ready</span><i><b style={{ width: "79%" }} /></i><strong>38</strong></div><div><span>Attention</span><i><b style={{ width: "42%" }} /></i><strong>7</strong></div><div><span>Not ready</span><i><b style={{ width: "24%" }} /></i><strong>3</strong></div></div></div></article></div>

      <div className="dashboard-two-column lower"><article className="dashboard-panel rumi-dashboard"><div className="panel-title"><div><span>AGATA INTELLIGENCE</span><h2>Ask Rumi</h2></div><span className="local-badge">LOCAL AI</span></div><div className="rumi-dashboard-body"><div className="rumi-avatar-large">R</div><div><strong>Ask the workspace.</strong><p>Rumi explains readiness from structured AGATA data while the readiness engine remains the source of truth.</p><div className="rumi-suggestion">Why isn't Delta Safety Services ready? <span>→</span></div><Link to="/rumi">Open Rumi →</Link></div></div></article><article className="dashboard-panel activity-panel"><div className="panel-title"><div><span>RECENT ACTIVITY</span><h2>Workspace activity</h2></div><Link to="/audit">Audit trail →</Link></div><div className="activity-list"><div><span>08:42</span><p><b>Insurance Certificate</b> was added to evidence.</p></div><div><span>08:31</span><p><b>Infrastructure Upgrade</b> readiness was evaluated.</p></div><div><span>08:14</span><p><b>Acme Engineering Ltd</b> became ready.</p></div></div></article></div>

      <div className="dashboard-footer-prompt"><div><span>READY TO BUILD</span><h2>Start with the decision that matters.</h2><p>Create a project, define its requirements, and let AGATA turn evidence into a clear readiness decision.</p></div><Link className="dashboard-primary" to="/projects">Create project →</Link></div>
    </section>
  );
}
