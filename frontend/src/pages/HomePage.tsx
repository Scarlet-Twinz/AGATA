import { Link } from "react-router-dom";

const steps = [
  ["01", "Define the project", "Set the requirements that must be satisfied before work can move forward."],
  ["02", "Bring in contractors", "Keep each contractor's evidence profile connected to the work that matters."],
  ["03", "Connect the evidence", "Map certificates and other evidence to the requirements they satisfy."],
  ["04", "Know the answer", "AGATA evaluates readiness and explains exactly what is missing or invalid."],
];

const features = [
  ["Readiness intelligence", "Turn scattered compliance evidence into a clear project-level decision."],
  ["Evidence, not paperwork", "Keep the evidence that matters connected to the requirement it satisfies."],
  ["Explainable decisions", "See why a contractor is ready, needs attention, or is not ready."],
  ["Reusable requirements", "Build a requirement library once and apply it across projects."],
  ["Rumi intelligence", "Ask questions about your workspace without making AI the authority."],
  ["Built to grow", "Start with the workflow that matters and expand into deeper compliance operations."],
];

export function HomePage() {
  return (
    <>
      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-kicker"><span /> Compliance intelligence</div>
          <h1>Know who is ready <em>before</em> the work begins.</h1>
          <p className="hero-lead">AGATA brings projects, contractors, requirements, and evidence into one clear readiness workflow—so your team can make confident decisions without chasing paperwork.</p>
          <div className="hero-actions"><Link className="primary-button large" to="/signup">Start with AGATA <span>→</span></Link><Link className="secondary-button large" to="/how-it-works">See how it works</Link></div>
          <div className="hero-trust"><span>✓ Evidence-led</span><span>✓ Explainable</span><span>✓ Built for teams</span></div>
        </div>
        <div className="hero-visual" aria-label="AGATA readiness preview">
          <div className="glow-orb" />
          <div className="product-window">
            <div className="window-bar"><span /><span /><span /><b>AGATA</b><i>Workspace</i></div>
            <div className="mock-body">
              <div className="mock-sidebar"><div className="mock-logo">A</div><div className="mock-nav active">Overview</div><div className="mock-nav">Projects</div><div className="mock-nav">Contractors</div><div className="mock-nav">Evidence</div><div className="mock-nav">Rumi</div></div>
              <div className="mock-content">
                <div className="mock-heading"><div><small>PROJECT READINESS</small><h3>Infrastructure Upgrade</h3></div><span className="status-ready">READY</span></div>
                <div className="readiness-hero-card"><div className="score-ring"><strong>100</strong><small>%</small></div><div><small>CONTRACTOR</small><h4>Acme Engineering Ltd</h4><p>All required evidence is valid.</p></div></div>
                <div className="mock-grid"><div className="mock-mini"><small>REQUIREMENTS</small><strong>04</strong><span>All satisfied</span></div><div className="mock-mini"><small>EVIDENCE</small><strong>07</strong><span>Current</span></div><div className="mock-mini"><small>ATTENTION</small><strong>00</strong><span>Nothing pending</span></div></div>
                <div className="mock-list"><div><span className="check">✓</span> Insurance Certificate <b>Valid</b></div><div><span className="check">✓</span> Safety Certification <b>Valid</b></div><div><span className="check">✓</span> Tax Clearance <b>Valid</b></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="statement-section"><p className="section-kicker">The problem</p><h2>Compliance shouldn't feel like detective work.</h2><p>When requirements live in spreadsheets, certificates live in inboxes, and contractor status lives in someone's memory, every decision takes longer than it should.</p></section>

      <section className="steps-section"><div className="section-heading"><div><p className="section-kicker">How AGATA works</p><h2>From requirements to a decision.</h2></div><p>One connected workflow. One clear answer.</p></div><div className="steps-grid">{steps.map(([number,title,description]) => <article className="step-card" key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="features-section"><div className="section-heading"><div><p className="section-kicker">Inside AGATA</p><h2>Everything points back to readiness.</h2></div><p>Purpose-built intelligence instead of another pile of admin screens.</p></div><div className="features-grid">{features.map(([title,description]) => <article className="feature-card" key={title}><div className="feature-icon">✦</div><h3>{title}</h3><p>{description}</p></article>)}</div></section>

      <section className="rumi-section"><div className="rumi-copy"><p className="section-kicker">Meet Rumi</p><h2>Ask the workspace. Understand the answer.</h2><p>Rumi sits on top of AGATA's structured data. It can explain readiness, surface patterns, and help teams understand what needs attention—while the deterministic readiness engine remains the source of truth.</p><Link className="secondary-button" to="/rumi">Explore Rumi <span>→</span></Link></div><div className="rumi-card"><div className="rumi-avatar">R</div><div><small>RUMI · AGATA INTELLIGENCE</small><p>Why isn't Acme Engineering ready for the project?</p><div className="rumi-answer">Acme is missing a valid Safety Certification. Insurance and Tax Clearance are already satisfied.</div></div></div></section>

      <section className="cta-section"><p className="section-kicker">Ready when you are</p><h2>Make the next compliance decision with clarity.</h2><p>Start building your workspace and see how AGATA turns evidence into readiness.</p><Link className="primary-button large" to="/signup">Get started with AGATA <span>→</span></Link></section>
    </>
  );
}
