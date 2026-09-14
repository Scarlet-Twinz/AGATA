import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Decision = {
  id: string;
  project_id: string;
  contractor_id: string;
  status: "pending" | "approved" | "rejected";
  decided_by_user_id: string | null;
  decided_at: string | null;
  reason: string | null;
};

type ReadinessItem = {
  project_id: string;
  contractor_id: string;
  evaluated: boolean;
  score: number | null;
  status: string | null;
  explanation: string | null;
  missing_requirements: string[];
  checked_at: string | null;
};

type IntelligenceRequirement = {
  requirement_id: string;
  requirement_name: string;
  status: "satisfied" | "blocked";
  reason: string;
  action?: string;
  evidence: { document_id: string; document_name: string; state: string; reason?: string }[];
};

type ChangeAction = {
  action_type: "repair_evidence" | "provide_evidence";
  document_id?: string;
  document_name?: string;
  current_state?: string;
  resolves_requirements?: string[];
  requirement_id?: string;
  requirement_name?: string;
  action?: string;
};

type Intelligence = {
  engine_version: string;
  project_id: string;
  project_name: string;
  contractor_id: string;
  contractor_name: string;
  score: number;
  status: string;
  explanation: string;
  requirements: IntelligenceRequirement[];
  blockers: IntelligenceRequirement[];
  evidence: {
    document_id: string;
    document_name: string;
    state: string;
    affected_requirements: string[];
    blocked_requirements_it_could_resolve_if_repaired: string[];
  }[];
  minimum_change_set: ChangeAction[];
  fingerprint: string;
  latest_trace?: { id: string; created_at: string; fingerprint: string; engine_version: string } | null;
  previous_trace?: { id: string; created_at: string; fingerprint: string; score: number; status: string } | null;
  since_previous?: { score_delta: number; status_changed: boolean };
};

type Scenario = {
  current_score: number;
  projected_score: number;
  score_delta: number;
  current_status: string;
  projected_status: string;
  resolved_requirements: string[];
  remaining_blockers: string[];
};

type TimelineItem = {
  id: string;
  created_at: string;
  score: number;
  status: string;
  explanation: string;
  fingerprint: string;
  engine_version: string;
  requirement_count: number;
  evidence_count: number;
  blocker_count: number;
  change_set_count: number;
  score_delta: number | null;
  status_changed: boolean;
  blockers_added: string[];
  blockers_resolved: string[];
};

type Timeline = { project_id: string; contractor_id: string; count: number; items: TimelineItem[] };

function label(value: string | null) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Not evaluated";
}

function statusClass(status: string) {
  return status === "ready" ? "ready" : status === "not_ready" ? "blocked" : "attention";
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function ReadinessDecisionPage() {
  const { projectId, contractorId } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [readiness, setReadiness] = useState<ReadinessItem | null>(null);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [reason, setReason] = useState("");
  const [selectedRepairs, setSelectedRepairs] = useState<string[]>([]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!projectId || !contractorId) return;
    try {
      setLoading(true);
      setError("");
      const [decisionData, readinessList, intelligenceData, timelineData] = await Promise.all([
        api<Decision>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/decision`),
        api<ReadinessItem[]>("/api/readiness"),
        api<Intelligence>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/intelligence`),
        api<Timeline>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/timeline`),
      ]);
      setDecision(decisionData);
      setReadiness(readinessList.find((item) => item.project_id === projectId && item.contractor_id === contractorId) ?? null);
      setIntelligence(intelligenceData);
      setTimeline(timelineData);
      setScenario(null);
      setSelectedRepairs([]);
      setSelectedRequirements([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load readiness decision.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [projectId, contractorId]);

  async function decide(status: Decision["status"]) {
    if (!projectId || !contractorId) return;
    if (status === "rejected" && reason.trim().length < 3) {
      setError("Enter a reason before rejecting this readiness decision.");
      return;
    }
    try {
      setWorking(true);
      setError("");
      setMessage("");
      await api(`/api/readiness/projects/${projectId}/contractors/${contractorId}/decision`, {
        method: "POST",
        body: JSON.stringify({ status, reason: status === "rejected" ? reason.trim() : null }),
      });
      setReason("");
      setMessage(status === "pending" ? "Decision returned to pending." : `Decision ${status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update readiness decision.");
    } finally {
      setWorking(false);
    }
  }

  const selectedActionCount = selectedRepairs.length + selectedRequirements.length;
  const canSimulate = selectedActionCount > 0;
  const projectedLabel = useMemo(() => scenario ? label(scenario.projected_status) : "No scenario", [scenario]);

  async function simulate() {
    if (!projectId || !contractorId || !canSimulate) return;
    try {
      setSimulating(true);
      setError("");
      const result = await api<Scenario>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/simulate`, {
        method: "POST",
        body: JSON.stringify({ repair_evidence_ids: selectedRepairs, provide_requirement_ids: selectedRequirements }),
      });
      setScenario(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to simulate the selected changes.");
    } finally {
      setSimulating(false);
    }
  }

  function toggleRepair(id: string) {
    setScenario(null);
    setSelectedRepairs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleRequirement(id: string) {
    setScenario(null);
    setSelectedRequirements((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (loading) return <section className="decision-page"><div className="decision-state">Loading decision workspace…</div></section>;
  if (!decision || !readiness || !intelligence) return <section className="decision-page"><div className="decision-card"><strong>Decision unavailable</strong><p>{error || "Readiness has not been evaluated for this project assignment yet."}</p><button onClick={() => navigate("/readiness")}>Back to readiness</button></div></section>;

  const ready = readiness.status === "ready";
  const decided = decision.status !== "pending";
  const score = typeof readiness.score === "number" ? readiness.score : null;

  return <>
    <style>{styles}</style>
    <section className="decision-page">
      <button className="decision-back" onClick={() => navigate("/readiness")}>← Back to Readiness</button>
      <header className="decision-header">
        <div>
          <span className="decision-eyebrow">READINESS · DECISION WORKSPACE</span>
          <h1>Readiness decision</h1>
          <p>Review the deterministic result, inspect the evidence behind it, test proposed changes, and see how the decision has evolved.</p>
        </div>
        <div className="decision-jumpbar" aria-label="Decision sections">
          <button type="button" onClick={() => scrollToSection("decision-lens")}>Decision Lens <span>↓</span></button>
          <button type="button" onClick={() => scrollToSection("decision-timeline")}>Decision Timeline <span>↓</span></button>
        </div>
      </header>

      {error && <div className="decision-error">{error}</div>}
      {message && <div className="decision-success">{message}</div>}

      <div className="decision-context-bar">
        <div><span>PROJECT</span><strong>{intelligence.project_name}</strong></div>
        <div><span>CONTRACTOR</span><strong>{intelligence.contractor_name}</strong></div>
        <div><span>ENGINE</span><strong>{intelligence.engine_version}</strong></div>
        <div><span>STATE</span><strong className={statusClass(intelligence.status)}>{label(intelligence.status)} · {intelligence.score}%</strong></div>
      </div>

      <div className="decision-grid">
        <article className="decision-card decision-summary">
          <span className="decision-label">READINESS RESULT</span>
          <div className={`decision-result ${ready ? "ready" : "blocked"}`}>{label(readiness.status)}</div>
          <div className="decision-score">{score == null ? "—" : `${score}%`}<small>readiness score</small></div>
          <p>{readiness.explanation || "The readiness engine evaluates project requirements against contractor evidence."}</p>
          {readiness.missing_requirements.length > 0 && <div className="decision-missing"><span>Attention required</span>{readiness.missing_requirements.slice(0, 5).map((item) => <div key={item}>• {item}</div>)}</div>}
        </article>

        <article className="decision-card">
          <span className="decision-label">ORGANIZATIONAL DECISION</span>
          <div className="decision-current">{label(decision.status)}</div>
          {decision.reason && <div className="decision-reason"><span>Reason</span><p>{decision.reason}</p></div>}
          {decision.decided_at && <small className="decision-date">Recorded {new Date(decision.decided_at).toLocaleString()}</small>}
          <div className="decision-actions">
            <button className="decision-approve" disabled={working || !ready} onClick={() => void decide("approved")}>{working ? "Saving…" : "Approve readiness"}</button>
            <button className="decision-pending" disabled={working || !decided} onClick={() => void decide("pending")}>Return to pending</button>
          </div>
          <div className="decision-reject">
            <label htmlFor="decision-reason">Rejection reason</label>
            <textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this readiness decision is being rejected…" />
            <button className="decision-reject-btn" disabled={working || !reason.trim()} onClick={() => void decide("rejected")}>Reject decision</button>
          </div>
        </article>
      </div>

      <section id="decision-lens" className="lens-shell">
        <div className="section-anchor"><span>DECISION LENS</span><button type="button" onClick={() => scrollToSection("decision-lens")}>#</button></div>
        <div className="lens-head">
          <div>
            <span className="decision-label">AGATA DECISION LENS</span>
            <h2>Why this decision exists</h2>
            <p>Every blocker is tied to a requirement and its evidence. The change set below is calculated from the current workspace state.</p>
          </div>
          <div className={`lens-status ${statusClass(intelligence.status)}`}>{label(intelligence.status)} · {intelligence.score}%</div>
        </div>

        <div className="lens-columns">
          <div className="lens-panel">
            <span className="lens-kicker">BLOCKERS</span>
            {intelligence.blockers.length === 0 ? <div className="lens-empty">No blocking requirements. The current evidence set satisfies the project.</div> : intelligence.blockers.map((item) => <div className="lens-blocker" key={item.requirement_id}><div><strong>{item.requirement_name}</strong><span>{item.reason}</span></div><em>{item.evidence.length ? item.evidence.map((e) => `${e.document_name} · ${e.state}`).join(" / ") : "No evidence"}</em></div>)}
          </div>

          <div className="lens-panel">
            <span className="lens-kicker">MINIMUM CHANGE SET</span>
            {intelligence.minimum_change_set.length === 0 ? <div className="lens-empty">No change required.</div> : intelligence.minimum_change_set.map((action, index) => {
              const selected = action.action_type === "repair_evidence" ? !!action.document_id && selectedRepairs.includes(action.document_id) : !!action.requirement_id && selectedRequirements.includes(action.requirement_id);
              return <button className={`lens-action ${selected ? "selected" : ""}`} key={`${action.action_type}-${action.document_id || action.requirement_id || index}`} onClick={() => action.action_type === "repair_evidence" && action.document_id ? toggleRepair(action.document_id) : action.requirement_id ? toggleRequirement(action.requirement_id) : undefined}>
                <span className="lens-action-number">{index + 1}</span>
                <div><strong>{action.action_type === "repair_evidence" ? `Repair ${action.document_name}` : `Provide ${action.requirement_name}`}</strong><span>{action.action_type === "repair_evidence" ? `${action.current_state} → valid · ${action.resolves_requirements?.join(", ")}` : action.action}</span></div>
                <i>{selected ? "Selected" : "Select"}</i>
              </button>;
            })}
            <button className="lens-simulate" disabled={!canSimulate || simulating} onClick={() => void simulate()}>{simulating ? "Calculating impact…" : `Preview impact${selectedActionCount ? ` · ${selectedActionCount} selected` : ""}`}</button>
          </div>
        </div>

        {scenario && <div className="scenario-card"><div><span className="lens-kicker">COUNTERFACTUAL RESULT</span><strong>{scenario.current_score}% → {scenario.projected_score}%</strong><span>{label(scenario.current_status)} → {projectedLabel}</span></div><div className="scenario-delta">{scenario.score_delta >= 0 ? "+" : ""}{scenario.score_delta} pts</div><div className="scenario-details"><span>Resolved: {scenario.resolved_requirements.length ? scenario.resolved_requirements.join(", ") : "none"}</span><span>Remaining blockers: {scenario.remaining_blockers.length ? scenario.remaining_blockers.join(", ") : "none — projected ready"}</span></div></div>}

        <div className="lens-footer"><span>Decision fingerprint</span><code>{intelligence.fingerprint}</code>{intelligence.latest_trace && <span>State captured {new Date(intelligence.latest_trace.created_at).toLocaleString()}</span>}{intelligence.since_previous && <span>Since previous state: {intelligence.since_previous.score_delta >= 0 ? "+" : ""}{intelligence.since_previous.score_delta} pts{intelligence.since_previous.status_changed ? " · decision changed" : ""}</span>}</div>
      </section>

      <section id="decision-timeline" className="timeline-shell">
        <div className="section-anchor"><span>DECISION TIMELINE</span><button type="button" onClick={() => scrollToSection("decision-timeline")}>#</button></div>
        <div className="timeline-head">
          <div><span className="decision-label">DECISION MEMORY</span><h2>How the readiness state changed</h2><p>AGATA retains fingerprinted readiness states so reviewers can see what the engine saw over time instead of relying on the latest score alone.</p></div>
          <div className="timeline-count">{timeline?.count ?? 0} captured state{timeline?.count === 1 ? "" : "s"}</div>
        </div>
        <div className="timeline-list">
          {!timeline?.items.length ? <div className="timeline-empty">No readiness states have been captured yet.</div> : timeline.items.map((item, index) => <article className={`timeline-item ${index === 0 ? "current" : ""}`} key={item.id}>
            <div className="timeline-rail"><span className="timeline-dot" />{index < timeline.items.length - 1 && <span className="timeline-line" />}</div>
            <div className="timeline-body">
              <div className="timeline-top"><div><span className="timeline-time">{new Date(item.created_at).toLocaleString()}</span><strong>{label(item.status)}</strong></div><div className="timeline-score">{item.score}%</div></div>
              <p>{item.explanation}</p>
              <div className="timeline-metrics"><span>{item.requirement_count} requirements</span><span>{item.evidence_count} evidence records</span><span>{item.blocker_count} blockers</span><span>{item.change_set_count} change actions</span>{item.score_delta !== null && <span>{item.score_delta >= 0 ? "+" : ""}{item.score_delta} pts</span>}</div>
              {(item.blockers_added.length > 0 || item.blockers_resolved.length > 0) && <div className="timeline-changes">{item.blockers_added.length > 0 && <span className="added">New blockers: {item.blockers_added.join(", ")}</span>}{item.blockers_resolved.length > 0 && <span className="resolved">Resolved blockers: {item.blockers_resolved.join(", ")}</span>}</div>}
              <div className="timeline-fingerprint"><span>{item.engine_version}</span><code>{item.fingerprint}</code></div>
            </div>
          </article>)}
        </div>
      </section>

      <div className="decision-note"><strong>Source of truth</strong><span>Readiness is deterministic. Rumi can explain the result, but cannot override the evidence, requirements, or decision engine.</span></div>
    </section>
  </>;
}

const styles = `
.decision-page{max-width:1160px;margin:0 auto;padding:34px 30px 60px;color:#e7eef6}.decision-back{border:0;background:none;color:#7792aa;padding:0;cursor:pointer;font:600 11px inherit;margin-bottom:18px}.decision-back:hover{color:#c8d8e6}.decision-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-end}.decision-eyebrow,.decision-label,.lens-kicker{display:block;color:#718ca5;font-size:9px;font-weight:700;letter-spacing:.18em}.decision-page h1{margin:8px 0 0;font-size:40px;letter-spacing:-.04em}.decision-page header p{margin:10px 0 18px;color:#71869b;font-size:12px;line-height:1.55;max-width:730px}.decision-jumpbar{display:flex;gap:7px;flex-wrap:wrap}.decision-jumpbar button{border:1px solid #24415a;background:#07131f;color:#9db8cd;border-radius:9px;padding:9px 11px;font:650 9px inherit;cursor:pointer}.decision-jumpbar button:hover{border-color:#3b678b;background:#0a1b2a;color:#d4e4ef}.decision-jumpbar span{margin-left:5px;color:#5e7d97}.decision-error,.decision-success{border-radius:10px;padding:11px 13px;font-size:11px;margin:12px 0}.decision-error{border:1px solid #613740;background:#241419;color:#e2a0a8}.decision-success{border:1px solid #28563f;background:#0a2118;color:#78d3a0}.decision-context-bar{display:grid;grid-template-columns:1.4fr 1.4fr .7fr .9fr;gap:1px;background:#182a3b;border:1px solid #1b3044;border-radius:12px;overflow:hidden;margin:8px 0 14px}.decision-context-bar>div{background:#07111b;padding:11px 13px}.decision-context-bar span{display:block;color:#5e7890;font-size:8px;letter-spacing:.13em;font-weight:700}.decision-context-bar strong{display:block;color:#cddce8;font-size:10px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.decision-context-bar strong.ready{color:#72d5a0}.decision-context-bar strong.blocked{color:#e18a94}.decision-context-bar strong.attention{color:#dec56e}.decision-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:14px}.decision-card{border:1px solid #1b3044;border-radius:15px;background:#060d15;padding:22px}.decision-result{margin-top:16px;font-size:26px;font-weight:750}.decision-result.ready{color:#70d69e}.decision-result.blocked{color:#e1c16b}.decision-score{margin-top:22px;font-size:34px;font-weight:700}.decision-score small{display:block;margin-top:4px;color:#647c93;font-size:9px;font-weight:500}.decision-card p{color:#657d94;font-size:11px;line-height:1.55}.decision-missing{margin-top:16px;border-top:1px solid #182a3b;padding-top:12px;color:#c7a65c;font-size:10px;line-height:1.6}.decision-missing span{display:block;color:#7f8fa1;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.decision-current{margin:14px 0 18px;color:#c9d8e5;font-size:22px;font-weight:700}.decision-reason{border-top:1px solid #182a3b;padding-top:14px}.decision-reason span{color:#647d95;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.decision-reason p{margin:7px 0}.decision-date{color:#5e758b;font-size:9px}.decision-actions{display:flex;gap:8px;margin-top:18px}.decision-actions button,.decision-reject-btn,.decision-card button{border-radius:8px;padding:9px 12px;font:650 10px inherit;cursor:pointer}.decision-approve{border:1px solid #2a6948;background:#0b2418;color:#76d49d}.decision-approve:disabled{opacity:.4;cursor:not-allowed}.decision-pending{border:1px solid #29435a;background:#0a1723;color:#91aac0}.decision-pending:disabled{opacity:.4;cursor:not-allowed}.decision-reject{margin-top:18px;padding-top:17px;border-top:1px solid #182a3b}.decision-reject label{display:block;color:#70879d;font-size:10px;margin-bottom:7px}.decision-reject textarea{width:100%;min-height:82px;resize:vertical;box-sizing:border-box;border:1px solid #1e3449;border-radius:9px;background:#07111b;color:#dce6ef;padding:10px;font:500 11px/1.45 inherit;outline:none}.decision-reject textarea:focus{border-color:#3c6384}.decision-reject-btn{margin-top:8px;border:1px solid #64383f;background:#25151a;color:#dd929b}.decision-reject-btn:disabled{opacity:.4;cursor:not-allowed}.lens-shell,.timeline-shell{scroll-margin-top:20px;margin-top:16px;border:1px solid #1b3044;border-radius:15px;background:#050b13;overflow:hidden}.section-anchor{display:flex;align-items:center;justify-content:space-between;padding:9px 18px;border-bottom:1px solid #182a3b;background:#07111b;color:#5d7890;font-size:8px;letter-spacing:.15em;font-weight:750}.section-anchor button{border:0;background:transparent;color:#55718a;cursor:pointer;font-size:12px}.lens-head,.timeline-head{padding:21px 22px;border-bottom:1px solid #182a3b;display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.lens-head h2,.timeline-head h2{margin:7px 0 0;font-size:21px;letter-spacing:-.02em}.lens-head p,.timeline-head p{margin:7px 0 0;color:#647c93;font-size:10px;line-height:1.5;max-width:690px}.lens-status{white-space:nowrap;border:1px solid #2b4154;background:#0b1722;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:700}.lens-status.ready{border-color:#28583f;background:#0a2419;color:#6fd59d}.lens-status.blocked{border-color:#653a40;background:#261419;color:#e28a94}.lens-status.attention{border-color:#665529;background:#211d0d;color:#e0c56b}.lens-columns{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#182a3b}.lens-panel{background:#060d15;padding:18px}.lens-kicker{color:#607b94;font-size:8px;margin-bottom:11px}.lens-blocker{padding:11px 0;border-top:1px solid #152638;display:flex;justify-content:space-between;gap:14px}.lens-blocker:first-of-type{border-top:0;padding-top:0}.lens-blocker strong{display:block;color:#dbe6ef;font-size:11px}.lens-blocker span{display:block;color:#687f95;font-size:9px;margin-top:4px;line-height:1.4}.lens-blocker em{font-style:normal;color:#c98d96;font-size:8px;text-align:right;max-width:180px}.lens-empty{color:#657d94;font-size:10px;line-height:1.5;padding:8px 0}.lens-action{width:100%;border:1px solid #172b3d;background:#07111b;color:#cbd8e4;border-radius:9px;padding:10px;display:flex;align-items:flex-start;gap:10px;text-align:left;margin-bottom:7px}.lens-action:hover,.lens-action.selected{border-color:#3c6384;background:#091a29}.lens-action-number{width:20px;height:20px;border:1px solid #28445d;border-radius:6px;display:grid;place-items:center;color:#7895ad;font-size:8px;flex:none}.lens-action strong{display:block;font-size:10px}.lens-action span{display:block;color:#647d94;font-size:8px;margin-top:4px;line-height:1.4}.lens-action i{margin-left:auto;color:#66849e;font-size:8px;font-style:normal;white-space:nowrap}.lens-action.selected i{color:#72d3a0}.lens-simulate{width:100%;margin-top:3px;border:1px solid #315d83;background:#0a1a29;color:#a9c6dc}.lens-simulate:disabled{opacity:.4;cursor:not-allowed}.scenario-card{margin:1px;background:#07121d;border-top:1px solid #20364a;padding:17px 19px;display:grid;grid-template-columns:1fr auto;gap:10px}.scenario-card strong{display:block;font-size:22px}.scenario-card>div>span{display:block;color:#6b849a;font-size:9px;margin-top:5px}.scenario-delta{align-self:center;color:#71d4a0;font-size:14px;font-weight:700}.scenario-details{grid-column:1/-1;border-top:1px solid #172a3b;padding-top:10px;display:flex;flex-wrap:wrap;gap:16px;color:#71889d;font-size:9px;line-height:1.5}.lens-footer{padding:11px 18px;border-top:1px solid #182a3b;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:#5d768d;font-size:8px}.lens-footer code{color:#7691a9;max-width:350px;overflow:hidden;text-overflow:ellipsis}.timeline-count{border:1px solid #25425a;background:#071722;color:#8eacc3;border-radius:999px;padding:7px 10px;font-size:9px;white-space:nowrap}.timeline-list{padding:8px 18px 20px}.timeline-item{display:grid;grid-template-columns:26px 1fr;gap:11px;min-height:150px}.timeline-rail{position:relative;display:flex;justify-content:center}.timeline-dot{width:10px;height:10px;margin-top:19px;border:2px solid #3a5e7c;border-radius:50%;background:#07111b;z-index:1}.timeline-item.current .timeline-dot{border-color:#71d4a0;background:#0c2a1d;box-shadow:0 0 0 4px rgba(113,212,160,.08)}.timeline-line{position:absolute;top:29px;bottom:0;width:1px;background:#20364a}.timeline-body{border:1px solid #162b3d;border-radius:11px;background:#07111b;padding:13px 14px;margin-bottom:9px}.timeline-item.current .timeline-body{border-color:#29465e;background:#081622}.timeline-top{display:flex;justify-content:space-between;gap:15px}.timeline-time{display:block;color:#5d7890;font-size:8px;margin-bottom:5px}.timeline-top strong{color:#d5e2ec;font-size:12px}.timeline-score{color:#b8cfe0;font-size:17px;font-weight:750}.timeline-body p{margin:9px 0;color:#70879c;font-size:9px;line-height:1.5}.timeline-metrics{display:flex;flex-wrap:wrap;gap:7px}.timeline-metrics span{border:1px solid #1b3348;background:#081723;color:#66839b;border-radius:999px;padding:4px 7px;font-size:8px}.timeline-changes{display:flex;flex-wrap:wrap;gap:8px;margin-top:9px}.timeline-changes span{font-size:8px}.timeline-changes .added{color:#d58c95}.timeline-changes .resolved{color:#72d3a0}.timeline-fingerprint{display:flex;align-items:center;gap:9px;margin-top:10px;padding-top:9px;border-top:1px solid #14283a;color:#536e86;font-size:8px}.timeline-fingerprint code{color:#6b88a1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.timeline-empty{padding:24px;color:#657d94;font-size:10px}.decision-note{margin-top:14px;border:1px solid #172b3d;border-radius:12px;background:#07111b;padding:14px 16px;display:flex;gap:12px;font-size:10px}.decision-note strong{color:#a5bdd1;white-space:nowrap}.decision-note span{color:#647c93;line-height:1.5}.decision-state{min-height:320px;display:grid;place-items:center;color:#70869b;font-size:12px}@media(max-width:900px){.decision-header{align-items:flex-start;flex-direction:column}.decision-grid,.lens-columns{grid-template-columns:1fr}.decision-context-bar{grid-template-columns:1fr 1fr}.lens-head,.timeline-head{flex-direction:column}.decision-page{padding:28px 18px}.decision-page h1{font-size:32px}}@media(max-width:560px){.decision-context-bar{grid-template-columns:1fr}.decision-jumpbar{width:100%}.decision-jumpbar button{flex:1}.timeline-item{grid-template-columns:20px 1fr}.timeline-list{padding-left:11px;padding-right:11px}}
`;
