const metrics = [
  ["Readiness", "—", "No projects evaluated yet"],
  ["Contractors", "0", "Add your first contractor"],
  ["Projects", "0", "Create your first project"],
  ["Attention", "0", "Nothing needs attention"],
];

export function DashboardPage() {
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Command center</p>
          <h1>Good morning</h1>
          <p className="muted">One operational picture for your compliance work.</p>
        </div>
        <div className="readiness-pill">AGATA · ACTIVE DEVELOPMENT</div>
      </div>

      <div className="metric-grid">
        {metrics.map(([label, value, note]) => (
          <article className="metric-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Readiness</p><h2>Project compliance</h2></div></div>
          <div className="empty-state"><strong>No readiness checks yet</strong><span>Create a project, add requirements, and assign a contractor to start evaluating readiness.</span></div>
        </article>
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Intelligence</p><h2>Rumi</h2></div><span className="ready-badge">LOCAL AI</span></div>
          <div className="rumi-preview"><p>Ask Rumi about your compliance data.</p><span>Rumi will use application data directly when a deterministic answer is possible, and Ollama when language reasoning is required.</span></div>
        </article>
      </div>
    </section>
  );
}
