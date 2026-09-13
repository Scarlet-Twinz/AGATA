import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Decision = { id: string; project_id: string; contractor_id: string; status: "pending" | "approved" | "rejected"; decided_by_user_id: string | null; decided_at: string | null; reason: string | null };
type ReadinessItem = { project_id: string; contractor_id: string; evaluated: boolean; score: number | null; status: string | null; explanation: string | null; missing_requirements: string[]; checked_at: string | null };
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ReadinessDecisionPage() {
  const { projectId, contractorId } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [readiness, setReadiness] = useState<ReadinessItem | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!projectId || !contractorId) return;
    try {
      setLoading(true); setError("");
      const [decisionData, readinessList] = await Promise.all([
        api<Decision>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/decision`),
        api<ReadinessItem[]>("/api/readiness"),
      ]);
      setDecision(decisionData);
      setReadiness(readinessList.find((item) => item.project_id === projectId && item.contractor_id === contractorId) ?? null);
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

  if (loading) return <section className="decision-page"><div className="decision-state">Loading decision…</div></section>;
  if (!decision || !readiness) return <section className="decision-page"><div className="decision-card"><strong>Decision unavailable</strong><p>{error || "Readiness has not been evaluated for this project assignment yet."}</p><button onClick={() => navigate("/readiness")}>Back to readiness</button></div></section>;

  const ready = readiness.status === "ready";
  const decided = decision.status !== "pending";
  const score = typeof readiness.score === "number" ? readiness.score : null;

  return <><style>{styles}</style><section className="decision-page">
    <button className="decision-back" onClick={() => navigate("/readiness")}>← Back to Readiness</button>
    <header><span className="decision-eyebrow">READINESS · DECISION</span><h1>Readiness decision</h1><p>Review the deterministic readiness result before recording the organizational decision.</p></header>
    {error && <div className="decision-error">{error}</div>}{message && <div className="decision-success">{message}</div>}
    <div className="decision-grid">
      <article className="decision-card decision-summary"><span className="decision-label">READINESS RESULT</span><div className={`decision-result ${ready ? "ready" : "blocked"}`}>{label(readiness.status)}</div><div className="decision-score">{score == null ? "—" : `${score}%`}<small>readiness score</small></div><p>{readiness.explanation || "The readiness engine evaluates project requirements against contractor evidence."}</p>{readiness.missing_requirements.length > 0 && <div className="decision-missing"><span>Attention required</span>{readiness.missing_requirements.slice(0, 5).map((item) => <div key={item}>• {item}</div>)}</div>}</article>
      <article className="decision-card"><span className="decision-label">ORGANIZATIONAL DECISION</span><div className="decision-current">{label(decision.status)}</div>{decision.reason && <div className="decision-reason"><span>Reason</span><p>{decision.reason}</p></div>}{decision.decided_at && <small className="decision-date">Recorded {new Date(decision.decided_at).toLocaleString()}</small>}
        <div className="decision-actions"><button className="decision-approve" disabled={working || !ready} onClick={() => void decide("approved")}>{working ? "Saving…" : "Approve readiness"}</button><button className="decision-pending" disabled={working || !decided} onClick={() => void decide("pending")}>Return to pending</button></div>
        <div className="decision-reject"><label htmlFor="decision-reason">Rejection reason</label><textarea id="decision-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain why this readiness decision is being rejected…"/><button className="decision-reject-btn" disabled={working || !reason.trim()} onClick={() => void decide("rejected")}>Reject decision</button></div>
      </article>
    </div>
    <div className="decision-note"><strong>Source of truth</strong><span>Readiness is computed from project requirements and valid contractor evidence. Rumi can explain the result, but does not override the deterministic decision engine.</span></div>
  </section></>;
}

const styles = `.decision-page{max-width:980px;margin:0 auto;padding:38px 30px 60px;color:#e7eef6}.decision-back{border:0;background:none;color:#7792aa;padding:0;cursor:pointer;font:600 11px inherit;margin-bottom:28px}.decision-back:hover{color:#c8d8e6}.decision-eyebrow,.decision-label{display:block;color:#718ca5;font-size:9px;font-weight:700;letter-spacing:.18em}.decision-page h1{margin:8px 0 0;font-size:40px;letter-spacing:-.04em}.decision-page header p{margin:10px 0 24px;color:#71869b;font-size:12px}.decision-error,.decision-success{border-radius:10px;padding:11px 13px;font-size:11px;margin-bottom:14px}.decision-error{border:1px solid #613740;background:#241419;color:#e2a0a8}.decision-success{border:1px solid #28563f;background:#0a2118;color:#78d3a0}.decision-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:14px}.decision-card{border:1px solid #1b3044;border-radius:15px;background:#060d15;padding:22px}.decision-result{margin-top:16px;font-size:26px;font-weight:750}.decision-result.ready{color:#70d69e}.decision-result.blocked{color:#e1c16b}.decision-score{margin-top:22px;font-size:34px;font-weight:700}.decision-score small{display:block;margin-top:4px;color:#647c93;font-size:9px;font-weight:500}.decision-card p{color:#657d94;font-size:11px;line-height:1.55}.decision-missing{margin-top:16px;border-top:1px solid #182a3b;padding-top:12px;color:#c7a65c;font-size:10px;line-height:1.6}.decision-missing span{display:block;color:#7f8fa1;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.decision-current{margin:14px 0 18px;color:#c9d8e5;font-size:22px;font-weight:700}.decision-reason{border-top:1px solid #182a3b;padding-top:14px}.decision-reason span{color:#647d95;font-size:9px;text-transform:uppercase;letter-spacing:.12em}.decision-reason p{margin:7px 0}.decision-date{color:#5e758b;font-size:9px}.decision-actions{display:flex;gap:8px;margin-top:18px}.decision-actions button,.decision-reject-btn,.decision-card button{border-radius:8px;padding:9px 12px;font:650 10px inherit;cursor:pointer}.decision-approve{border:1px solid #2a6948;background:#0b2418;color:#76d49d}.decision-approve:disabled{opacity:.4;cursor:not-allowed}.decision-pending{border:1px solid #29435a;background:#0a1723;color:#91aac0}.decision-pending:disabled{opacity:.4;cursor:not-allowed}.decision-reject{margin-top:18px;padding-top:17px;border-top:1px solid #182a3b}.decision-reject label{display:block;color:#70879d;font-size:10px;margin-bottom:7px}.decision-reject textarea{width:100%;min-height:82px;resize:vertical;box-sizing:border-box;border:1px solid #1e3449;border-radius:9px;background:#07111b;color:#dce6ef;padding:10px;font:500 11px/1.45 inherit;outline:none}.decision-reject textarea:focus{border-color:#3c6384}.decision-reject-btn{margin-top:8px;border:1px solid #64383f;background:#25151a;color:#dd929b}.decision-reject-btn:disabled{opacity:.4;cursor:not-allowed}.decision-note{margin-top:14px;border:1px solid #172b3d;border-radius:12px;background:#07111b;padding:14px 16px;display:flex;gap:12px;font-size:10px}.decision-note strong{color:#a5bdd1;white-space:nowrap}.decision-note span{color:#647c93;line-height:1.5}.decision-state{min-height:320px;display:grid;place-items:center;color:#70869b;font-size:12px}@media(max-width:760px){.decision-grid{grid-template-columns:1fr}.decision-page{padding:28px 18px}.decision-page h1{font-size:32px}.decision-actions{flex-wrap:wrap}}`;