import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Replay = {
  captured_at: string;
  engine_version: string;
  fingerprint: string;
  is_current: boolean;
  state: {
    score: number;
    status: string;
    explanation: string;
    requirements: Array<{ requirement_name?: string; [key: string]: unknown }>;
    evidence: Array<{ name?: string; [key: string]: unknown }>;
    blockers: Array<{ requirement_name?: string; [key: string]: unknown }>;
    change_set: Array<{ label?: string; [key: string]: unknown }>;
  };
  transition: {
    from_score: number | null;
    from_status: string | null;
    score_delta: number | null;
    status_changed: boolean;
    blockers_added: string[];
    blockers_resolved: string[];
  };
};

const label = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function ReadinessDecisionReplay({ projectId, contractorId, traceId }: { projectId: string; contractorId: string; traceId: string }) {
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setError("");
        const result = await api<Replay>(`/api/readiness/projects/${projectId}/contractors/${contractorId}/replay/${traceId}`);
        if (active) setData(result);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to replay this decision state.");
      }
    }
    void load();
    return () => { active = false; };
  }, [projectId, contractorId, traceId]);

  if (error) return <div className="replay-error">{error}</div>;
  if (!data) return <div className="replay-loading">Loading decision replay…</div>;

  const blockers = data.state.blockers.map((item) => item.requirement_name).filter(Boolean) as string[];
  const changes = data.state.change_set.map((item) => item.label).filter(Boolean) as string[];
  return <section className="decision-replay">
    <div className="replay-head">
      <div><span>DECISION REPLAY</span><h2>Reconstruct this captured state</h2><p>AGATA replays the stored decision trace rather than recalculating history from today's evidence.</p></div>
      <strong className={data.is_current ? "current" : "historical"}>{data.is_current ? "CURRENT STATE" : "HISTORICAL STATE"}</strong>
    </div>
    <div className="replay-verdict"><div><small>CAPTURED</small><b>{new Date(data.captured_at).toLocaleString()}</b></div><div><small>READINESS</small><b>{label(data.state.status)} · {data.state.score}%</b></div><div><small>ENGINE</small><b>{data.engine_version}</b></div></div>
    <div className="replay-transition"><small>TRANSITION</small>{data.transition.from_score === null ? <b>First captured decision state</b> : <b>{data.transition.from_score}% {label(data.transition.from_status || "")} → {data.state.score}% {label(data.state.status)} {data.transition.score_delta !== null ? `(${data.transition.score_delta >= 0 ? "+" : ""}${data.transition.score_delta} pts)` : ""}</b>}{data.transition.blockers_resolved.length > 0 && <span className="resolved">Resolved: {data.transition.blockers_resolved.join(", ")}</span>}{data.transition.blockers_added.length > 0 && <span className="added">Added: {data.transition.blockers_added.join(", ")}</span>}</div>
    <div className="replay-columns"><div><small>BLOCKERS IN THIS STATE</small>{blockers.length ? blockers.map((item) => <div className="replay-row" key={item}>{item}</div>) : <div className="replay-muted">No blockers recorded.</div>}</div><div><small>AVAILABLE CHANGE SET</small>{changes.length ? changes.map((item) => <div className="replay-row" key={item}>{item}</div>) : <div className="replay-muted">No change action recorded.</div>}</div></div>
    <p className="replay-explanation">{data.state.explanation}</p>
    <footer>Fingerprint <code>{data.fingerprint}</code></footer>
  </section>;
}

const style = document.createElement("style");
style.textContent = `.decision-replay{margin-top:14px;border:1px solid #29465e;border-radius:14px;background:#081622;padding:16px}.replay-head{display:flex;justify-content:space-between;gap:18px}.replay-head>div>span,.replay-verdict small,.replay-transition small,.replay-columns small{color:#6e899f;font-size:8px;font-weight:750;letter-spacing:.16em}.replay-head h2{margin:6px 0;font-size:18px}.replay-head p,.replay-explanation{margin:0;color:#71879c;font-size:9px;line-height:1.5}.replay-head strong{height:max-content;border:1px solid #2b4b64;border-radius:999px;padding:6px 8px;font-size:8px;color:#8fb2c9;white-space:nowrap}.replay-head strong.current{border-color:#286345;color:#73d49c}.replay-verdict{display:grid;grid-template-columns:1.2fr 1fr .7fr;gap:8px;margin-top:14px}.replay-verdict>div,.replay-transition,.replay-columns>div{border:1px solid #172e42;border-radius:9px;background:#07111b;padding:10px}.replay-verdict small{display:block;margin-bottom:5px}.replay-verdict b{font-size:10px;color:#c4d6e4}.replay-transition{margin-top:8px}.replay-transition small{display:block;margin-bottom:5px}.replay-transition b{display:block;font-size:10px;color:#d7e4ee}.resolved,.added{display:block;margin-top:6px;font-size:8px}.resolved{color:#73d49c}.added{color:#d99aa3}.replay-columns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.replay-columns small{display:block;margin-bottom:7px}.replay-row{padding:6px 0;border-top:1px solid #14283a;color:#9bb1c2;font-size:8px}.replay-muted,.replay-loading,.replay-error{color:#60788e;font-size:9px}.replay-explanation{margin-top:10px;padding-top:10px;border-top:1px solid #14283a}.decision-replay footer{margin-top:10px;padding-top:9px;border-top:1px solid #14283a;color:#526d84;font-size:8px}.decision-replay code{color:#6c8ba3;overflow:hidden;text-overflow:ellipsis}.replay-error{padding:10px;border:1px solid #613740;background:#241419;color:#e2a0a8;border-radius:9px}@media(max-width:700px){.replay-verdict,.replay-columns{grid-template-columns:1fr}.replay-head{flex-direction:column}}`;
document.head.appendChild(style);
