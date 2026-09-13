import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Issue = { requirement: string; affected_contractors: number };
type Summary = {
  project_id: string; project_name: string; contractor_count: number; ready_count: number;
  attention_count: number; not_ready_count: number; not_evaluated_count: number;
  average_score: number | null; decision_pending_count: number; decision_approved_count: number;
  decision_rejected_count: number; issues: Issue[];
};

export default function ProjectReadinessPage() {
  const { projectId } = useParams();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;
    void api<Summary>(`/api/readiness/projects/${projectId}/summary`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load project readiness."))
      .finally(() => setLoading(false));
  }, [projectId]);

  return <><style>{styles}</style><section className="prs-page">
    <Link className="prs-back" to={projectId ? `/projects/${projectId}` : "/projects"}>← Back to project</Link>
    {loading ? <div className="prs-state">Loading project readiness…</div> : error ? <div className="prs-error">{error}</div> : !data ? <div className="prs-state">Project readiness unavailable.</div> : <>
      <header><span>PROJECT · READINESS</span><h1>{data.project_name}</h1><p>Project-level view of contractor readiness, decisions, and the requirements creating exposure.</p></header>
      <div className="prs-grid">
        <article><small>AVERAGE READINESS</small><strong>{data.average_score == null ? "—" : `${data.average_score}%`}</strong><span>{data.contractor_count} assigned contractor{data.contractor_count === 1 ? "" : "s"}</span></article>
        <article><small>READY</small><strong className="good">{data.ready_count}</strong><span>cleared readiness checks</span></article>
        <article><small>ATTENTION</small><strong className="warn">{data.attention_count}</strong><span>need review</span></article>
        <article><small>NOT READY</small><strong className="bad">{data.not_ready_count}</strong><span>blocked by evidence</span></article>
      </div>
      <div className="prs-columns">
        <section className="prs-panel"><div className="prs-head"><div><small>DECISION CONTROL</small><h2>Organizational decisions</h2></div><Link to="/readiness">Open readiness</Link></div><div className="prs-decisions"><div><b>{data.decision_pending_count}</b><span>Pending</span></div><div><b>{data.decision_approved_count}</b><span>Approved</span></div><div><b>{data.decision_rejected_count}</b><span>Rejected</span></div><div><b>{data.not_evaluated_count}</b><span>Not evaluated</span></div></div></section>
        <section className="prs-panel"><div className="prs-head"><div><small>REQUIREMENT EXPOSURE</small><h2>Top issues</h2></div></div>{data.issues.length === 0 ? <p className="prs-empty">No outstanding requirement issues detected.</p> : <div className="prs-issues">{data.issues.map((issue) => <div key={issue.requirement}><span>{issue.requirement}</span><b>{issue.affected_contractors}</b></div>)}</div>}</section>
      </div>
    </>}
  </section></>;
}

const styles = `.prs-page{max-width:1080px;margin:0 auto;padding:38px 30px 60px;color:#e8eef7}.prs-back{display:inline-block;color:#7892aa;text-decoration:none;font-size:11px;font-weight:650;margin-bottom:28px}.prs-back:hover{color:#c8d8e6}.prs-page header>span,.prs-panel small{color:#7894ae;font-size:9px;font-weight:700;letter-spacing:.18em}.prs-page h1{margin:8px 0 0;font-size:40px;letter-spacing:-.04em}.prs-page header p{margin:10px 0 24px;color:#70879e;font-size:12px}.prs-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.prs-grid article{border:1px solid #1b3044;border-radius:13px;background:#06101a;padding:18px}.prs-grid small{display:block;color:#627d96;font-size:9px;letter-spacing:.12em}.prs-grid strong{display:block;margin:10px 0 5px;font-size:27px}.prs-grid strong.good{color:#70d59d}.prs-grid strong.warn{color:#dfc16a}.prs-grid strong.bad{color:#df858e}.prs-grid span{color:#5f7890;font-size:9px}.prs-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}.prs-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;padding:20px}.prs-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.prs-head h2{margin:7px 0 0;font-size:17px;letter-spacing:-.02em}.prs-head a{color:#8aacca;font-size:10px;text-decoration:none}.prs-decisions{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:20px}.prs-decisions div{border:1px solid #172b3d;border-radius:10px;background:#08131f;padding:12px}.prs-decisions b{display:block;font-size:20px}.prs-decisions span{display:block;margin-top:4px;color:#607a92;font-size:9px}.prs-issues{margin-top:17px}.prs-issues div{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #142638}.prs-issues div:last-child{border-bottom:0}.prs-issues span{color:#b9cad8;font-size:11px}.prs-issues b{min-width:26px;text-align:center;color:#dfc16a;font-size:11px}.prs-empty{color:#657e96;font-size:11px;margin:20px 0}.prs-state{min-height:320px;display:grid;place-items:center;color:#6d849b;font-size:12px}.prs-error{border:1px solid #633a42;background:#25171b;color:#e2a0a8;border-radius:10px;padding:12px;font-size:11px}@media(max-width:800px){.prs-grid{grid-template-columns:repeat(2,1fr)}.prs-columns{grid-template-columns:1fr}}@media(max-width:520px){.prs-page{padding:26px 16px}.prs-page h1{font-size:32px}.prs-grid{grid-template-columns:1fr}.prs-decisions{grid-template-columns:repeat(2,1fr)}}`;
