import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Decision = { id: string; project_id: string; contractor_id: string; status: "pending" | "approved" | "rejected"; decided_by_user_id: string | null; decided_at: string | null; reason: string | null };
type ReadinessItem = { project_id: string; contractor_id: string; evaluated: boolean; score: number | null; status: string | null; explanation: string | null; missing_requirements: string[]; checked_at: string | null };
type IntelligenceRequirement = { requirement_id: string; requirement_name: string; status: "satisfied" | "blocked"; reason: string; action?: string; evidence: { document_id: string; document_name: string; state: string; reason?: string }[] };
type ChangeAction = { action_type: "repair_evidence" | "provide_evidence"; document_id?: string; document_name?: string; current_state?: string; resolves_requirements?: string[]; requirement_id?: string; requirement_name?: string; action?: string };
type Intelligence = { engine_version: string; project_id: string; project_name: string; contractor_id: string; contractor_name: string; score: number; status: string; explanation: string; requirements: IntelligenceRequirement[]; blockers: IntelligenceRequirement[]; evidence: { document_id: string; document_name: string; state: string; affected_requirements: string[]; blocked_requirements_it_could_resolve_if_repaired: string[] }[]; minimum_change_set: ChangeAction[]; fingerprint: string; latest_trace?: { id: string; created_at: string; fingerprint: string; engine_version: string } | null; previous_trace?: { id: string; created_at: string; fingerprint: string; score: number; status: string } | null; since_previous?: { score_delta: number; status_changed: boolean } };
type Scenario = { current_score: number; projected_score: number; score_delta: number; current_status: string; projected_status: string; resolved_requirements: string[]; remaining_blockers: string[] };

function label(value: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Not evaluated"; }
function statusClass(status: string) { return status === "ready" ? "ready" : status === "not_ready" ? "blocked" : "attention"; }

export default function ReadinessDecisionPage() {
  const { projectId, contractorId } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [readiness, setReadiness] = useState<ReadinessItem | null>(null);
  const [intelligence, setIntelligence] = useState<Intelligence | null>(null);
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
      setLoading(true); setError("");
      const [decisionData, readinessList, intelligenceData] = await Promise.all([
        api<Decision>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/decision`),
        api<ReadinessItem[]>("/api/readiness"),
        api<Intelligence>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/intelligence`),
      ]);
      setDecision(decisionData);
      setReadiness(readinessList.find((item) => item.project_id === projectId && item.contractor_id === contractorId) ?? null);
      setIntelligence(intelligenceData);
      setScenario(null);
      setSelectedRepairs([]);
      setSelectedRequirements([]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load readiness decision."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [projectId, contractorId]);

  async function decide(status: Decision["status"]) {
    if (!projectId || !contractorId) return;
    if (status === "rejected" && reason.trim().length < 3) { setError("Enter a reason before rejecting this readiness decision."); return; }
    try {
      setWorking(true); setError(""); setMessage("");
      await api(`/api/readiness/projects/${projectId}/contractors/${contractorId}/decision`, { method: "POST", body: JSON.stringify({ status, reason: status === "rejected" ? reason.trim() : null }) });
      setReason(""); setMessage(status === "pending" ? "Decision returned to pending." : `Decision ${status}.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update readiness decision."); }
    finally { setWorking(false); }
  }

  const selectedActionCount = selectedRepairs.length + selectedRequirements.length;
  const canSimulate = selectedActionCount > 0;
  const projectedLabel = useMemo(() => scenario ? label(scenario.projected_status) : "No scenario", [scenario]);

  async function simulate() {
    if (!projectId || !contractorId || !canSimulate) return;
    try {
      setSimulating(true); setError("");
      const result = await api<Scenario>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/simulate`, {
        method: "POST",
        body: JSON.stringify({ repair_evidence_ids: selectedRepairs, provide_requirement_ids: selectedRequirements }),
      });
      setScenario(result);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to simulate the selected changes."); }
    finally { setSimulating(false); }
  }

  function toggleRepair(id: string) { setScenario(null); setSelectedRepairs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleRequirement(id: string) { setScenario(null); setSelectedRequirements((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }

  if (loading) return <section className="decision-page"><div className="decision-state">Loading decision intelligence…</div></section>;
  if (!decision || !readiness || !intelligence) return <section className="decision-page"><div className="decision-card"><strong>Decision unavailable</strong><p>{error || "Readiness has not been evaluated for this project assignment yet."}</p><button onClick={() => navigate("/readiness")}>Back to readiness</button></div></section>;

  const ready = readiness.status === "ready";
  const decided = decision.status !== "pending";
  const score = typeof readiness.score === "number" ? readiness.score : null;

  return <><style>{styles}</style><section className="decision-page">
    <button className="decision-back" onClick={() => navigate("/readiness")}>← Back to Readiness</button>
    <header><span className="decision-eyebrow">READINESS · DECISION</span><h1>Readiness decision</h1><p>Review the deterministic result, inspect the evidence behind it, and test the smallest changes that could move the decision.</p></header>
    {error && <div className="decision-error">{error}</div>}{message && <div className="decision-success">{message}</div>}

    <div className="decision-grid">
      <article className="decision-card decision-summary"><span className="decision-label">READINESS RESULT</span><div className={`decision-result ${ready ? "ready" : "blocked"}`}>{label(readiness.status)}</div><div className="decision-score">{score == null ? "—" : `${score}%`}<small>readiness score</small></div><p>{readiness.explanation || "The readiness engine evaluates project requirements against contractor evidence."}</p>{readiness.missing_requirements.length > 0 && <div className="decision-missing"><span>Attention required</span>{readiness.missing_requirements.slice(0, 5).map((item) => <div key={item}>• {item}</div>)}</div>}</article>
      <article className="decision-card"><span className="decision-label">ORGANIZATIONAL DECISION</span><div className="decision-current">{label(decision.status)}</div>{decision.reason && <div className="decision-reason"><span>Reason</span><p>{decision.reason}</p></div>}{decision.decided_at && <small className="decision-date">Recorded {new Date(decision.decided_at).toLocaleString()}</small>}
        <div className="decision-actions"><button className="decision-approve" disabled={working || !ready} onClick={() => void decide("approved")}>{working ? "Saving…" : "Approve readiness"}</button><button className="decision-pending" disabled={working || !decided} onClick={() => void decide("pending")}>Return to pending</button></div>
        <div className="decision-reject"><label htmlFor="decision-reason">Rejection reason</label><textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this readiness decision is being rejected…"/><button className="decision-reject-btn" disabled={working || !reason.trim()} onClick={() => void decide("rejected")}>Reject decision</button></div>
      </article>
    </div>

    <section className="lens-shell">
      <div className="lens-head"><div><span className="decision-label">AGATA DECISION LENS</span><h2>Why this decision exists</h2><p>Every blocker is tied to a requirement and its evidence. The change set below is calculated from the current workspace state.</p></div><div className={`lens-status ${statusClass(intelligence.status)}`}>{label(intelligence.status)} · {intelligence.score}%</div></div>

      <div className="lens-columns">
        <div className="lens-panel"><span className="lens-kicker">BLOCKERS</span>{intelligence.blockers.length === 0 ? <div className="lens-empty">No blocking requirements. The current evidence set satisfies the project.</div> : intelligence.blockers.map((item) => <div className="lens-blocker" key={item.requirement_id}><div><strong>{item.requirement_name}</strong><span>{item.reason}</span></div><em>{item.evidence.length ? item.evidence.map((e) => `${e.document_name} · ${e.state}`).join(" / ") : "No evidence"}</em></div>)}</div>

        <div className="lens-panel"><span className="lens-kicker">MINIMUM CHANGE SET</span>{intelligence.minimum_change_set.length === 0 ? <div className="lens-empty">No change required.</div> : intelligence.minimum_change_set.map((action, index) => { const selected = action.action_type === "repair_evidence" ? !!action.document_id && selectedRepairs.includes(action.document_id) : !!action.requirement_id && selectedRequirements.includes(action.requirement_id); return <button className={`lens-action ${selected ? "selected" : ""}`} key={`${action.action_type}-${action.document_id || action.requirement_id || index}`} onClick={() => action.action_type === "repair_evidence" && action.document_id ? toggleRepair(action.document_id) : action.requirement_id ? toggleRequirement(action.requirement_id) : undefined}><span className="lens-action-number">{index + 1}</span><div><strong>{action.action_type === "repair_evidence" ? `Repair ${action.document_name}` : `Provide ${action.requirement_name}`}</strong><span>{action.action_type === "repair_evidence" ? `${action.current_state} → valid · ${action.resolves_requirements?.join(", ")}` : action.action}</span></div><i>{selected ? "Selected" : "Select"}</i></button>; })}<button className="lens-simulate" disabled={!canSimulate || simulating} onClick={() => void simulate()}>{simulating ? "Calculating impact…" : `Preview impact${selectedActionCount ? ` · ${selectedActionCount} selected` : ""}`}</button></div>
      </div>

      {scenario && <div className="scenario-card"><div><span className="lens-kicker">COUNTERFACTUAL RESULT</span><strong>{scenario.current_score}% → {scenario.projected_score}%</strong><span>{label(scenario.current_status)} → {projectedLabel}</span></div><div className="scenario-delta">{scenario.score_delta >= 0 ? "+" : ""}{scenario.score_delta} pts</div><div className="scenario-details"><span>Resolved: {scenario.resolved_requirements.length ? scenario.resolved_requirements.join(", ") : "none"}</span><span>Remaining blockers: {scenario.remaining_blockers.length ? scenario.remaining_blockers.join(", ") : "none — projected ready"}</span></div></div>}

      <div className="lens-footer"><span>Decision fingerprint</span><code>{intelligence.fingerprint}</code>{intelligence.latest_trace && <span>State captured {new Date(intelligence.latest_trace.created_at).toLocaleString()}</span>}{intelligence.since_previous && <span>Since previous state: {intelligence.since_previous.score_delta >= 0 ? "+" : ""}{intelligence.since_previous.score_delta} pts{intelligence.since_previous.status_changed ? " · decision changed" : ""}</span>}</div>
    </section>

    <div className="decision-note"><strong>Source of truth</strong><span>Readiness is deterministic. Rumi can explain the result, but cannot override the evidence, requirements, or decision engine.</span></div>
  </section></>;
}

const styles = `.decision-page{max-width:1100px;margin:0 auto;padding:38px 30px 60px;color:#e7eef6}.decision-back{border:0;background:none;color:#7792aa;padding:0;cursor:pointer;font:600 11px inherit;margin-bottom:28px}.decision-back:hover{color:#c8d8e6}.decision-eyebrow,.decision-label,.lens-kicker{display:block;color:#718ca5;font-size:9px;font-weight:700;letter-spacing:.18em}.decision-page h1{margin:8px 0 0;font-size:40px;letter-spacing:-.04em}.decision-page header p{margin:10px 0 24px;color:#71869b;font-size:12px}.decision-error,.decision-success{border-radius:10px;padding:11px 13px;font-size:11px;margin-bottom:14px}.decision-error{border:1px solid #613740;background:#241419;color:#e2a0a8}.decision-success{border:1px solid #28563f;background:#0a2118;color:#78d3a0}.decision-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:14px}.decision-card{border:1px solid #1b3044;border-radius:15px;background:#060d15;padding:22px}.decision-result{margin-top:16px;font-size:26px;font-weight:750}.decision-result.ready{color:#70d69e}.decision-result.blocked{color:#e1c16b}.decision-score{margin-top:22px;font-size:34px;font-weight:700}.decision-score small{display:block;margin-top:4px;color:#647c93;font-size:9px;font-weight:500}.decision-card p{color:#657d94;font-size:11px;line-height:1.55}.decision-missing{margin-top:16px;border-top:1px solid #182a3b;padding-top:12px;color:#c7a65c;font-size:10px;line-height:1.6}.decision-missing span{display:block;color:#7f8fa1;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.decision-current{margin:14px 0 18px;color:#c9d8e5;font-size:22px;font-weight:700}.decision-reason{border-top:1px solid #182a3b;padding-top:14px}.decision-reason span{color:#647d95;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.decision-reason p{margin:7px 0}.decision-date{color:#5e758b;font-size:9px}.decision-actions{display:flex;gap:8px;margin-top:18px}.decision-actions button,.decision-reject-btn,.decision-card button{border-radius:8px;padding:9px 12px;font:650 10px inherit;cursor:pointer}.decision-approve{border:1px solid #2a6948;background:#0b2418;color:#76d49d}.decision-approve:disabled{opacity:.4;cursor:not-allowed}.decision-pending{border:1px solid #29435a;background:#0a1723;color:#91aac0}.decision-pending:disabled{opacity:.4;cursor:not-allowed}.decision-reject{margin-top:18px;padding-top:17px;border-top:1px solid #182a3b}.decision-reject label{display:block;color:#70879d;font-size:10px;margin-bottom:7px}.decision-reject textarea{width:100%;min-height:82px;resize:vertical;box-sizing:border-box;border:1px solid #1e3449;border-radius:9px;background:#07111b;color:#dce6ef;padding:10px;font:500 11px/1.45 inherit;outline:none}.decision-reject textarea:focus{border-color:#3c6384}.decision-reject-btn{margin-top:8px;border:1px solid #64383f;background:#25151a;color:#dd929b}.decision-reject-btn:disabled{opacity:.4;cursor:not-allowed}.lens-shell{margin-top:16px;border:1px solid #1b3044;border-radius:15px;background:#050b13;overflow:hidden}.lens-head{padding:21px 22px;border-bottom:1px solid #182a3b;display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.lens-head h2{margin:7px 0 0;font-size:21px;letter-spacing:-.02em}.lens-head p{margin:7px 0 0;color:#647c93;font-size:10px;line-height:1.5;max-width:640px}.lens-status{white-space:nowrap;border:1px solid #2b4154;background:#0b1722;border-radius:999px;padding:7px 10px;font-size:9px;font-weight:700}.lens-status.ready{border-color:#28583f;background:#0a2419;color:#6fd59d}.lens-status.blocked{border-color:#653a40;background:#261419;color:#e28a94}.lens-status.attention{border-color:#665529;background:#211d0d;color:#e0c56b}.lens-columns{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#182a3b}.lens-panel{background:#060d15;padding:18px}.lens-kicker{color:#607b94;font-size:8px;margin-bottom:11px}.lens-blocker{padding:11px 0;border-top:1px solid #152638;display:flex;justify-content:space-between;gap:14px}.lens-blocker:first-of-type{border-top:0;padding-top:0}.lens-blocker strong{display:block;color:#dbe6ef;font-size:11px}.lens-blocker span{display:block;color:#687f95;font-size:9px;margin-top:4px;line-height:1.4}.lens-blocker em{font-style:normal;color:#c98d96;font-size:8px;text-align:right;max-width:180px}.lens-empty{color:#657d94;font-size:10px;line-height:1.5;padding:8px 0}.lens-action{width:100%;border:1px solid #172b3d;background:#07111b;color:#cbd8e4;border-radius:9px;padding:10px;display:flex;align-items:flex-start;gap:10px;text-align:left;margin-bottom:7px}.lens-action:hover,.lens-action.selected{border-color:#3c6384;background:#091a29}.lens-action-number{width:20px;height:20px;border:1px solid #28445d;border-radius:6px;display:grid;place-items:center;color:#7895ad;font-size:8px;flex:none}.lens-action strong{display:block;font-size:10px}.lens-action span{display:block;color:#647d94;font-size:8px;margin-top:4px;line-height:1.4}.lens-action i{margin-left:auto;color:#66849e;font-size:8px;font-style:normal;white-space:nowrap}.lens-action.selected i{color:#72d3a0}.lens-simulate{width:100%;margin-top:3px;border:1px solid #315d83;background:#0a1a29;color:#a9c6dc}.lens-simulate:disabled{opacity:.4;cursor:not-allowed}.scenario-card{margin:1px;background:#07121d;border-top:1px solid #20364a;padding:17px 19px;display:grid;grid-template-columns:1fr auto;gap:10px}.scenario-card strong{display:block;font-size:22px}.scenario-card>div>span{display:block;color:#6b849a;font-size:9px;margin-top:5px}.scenario-delta{align-self:center;color:#71d4a0;font-size:14px;font-weight:700}.scenario-details{grid-column:1/-1;border-top:1px solid #172a3b;padding-top:10px;display:flex;flex-wrap:wrap;gap:16px;color:#71889d;font-size:9px;line-height:1.5}.lens-footer{padding:11px 18px;border-top:1px solid #182a3b;display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:#5d768d;font-size:8px}.lens-footer code{color:#7691a9;max-width:350px;overflow:hidden;text-overflow:ellipsis}.decision-note{margin-top:14px;border:1px solid #172b3d;border-radius:12px;background:#07111b;padding:14px 16px;display:flex;gap:12px;font-size:10px}.decision-note strong{color:#a5bdd1;white-space:nowrap}.decision-note span{color:#647c93;line-height:1.5}.decision-state{min-height:320px;display:grid;place-items:center;color:#70869b;font-size:12px}@media(max-width:800px){.decision-grid,.lens-columns{grid-template-columns:1fr}.lens-head{flex-direction:column}.scenario-card{grid-template-columns:1fr}.decision-page{padding:28px 18px}.decision-page h1{font-size:32px}}`;
