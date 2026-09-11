import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Data = {
  generated_at: string;
  overview: Record<string, number | null>;
  readiness_distribution: Record<string, number>;
  project_risk: { id: string; name: string; score: number | null; risk: string; checks: number }[];
  signals: { key: string; label: string; value: number; description: string }[];
};

const css = `
.insights-page{max-width:1180px;margin:0 auto;padding:32px;color:#eef2f7}.insights-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-end;margin-bottom:28px}.eyebrow{font-size:11px;letter-spacing:1.8px;color:#7f8b9d}.insights-head h1{font-size:32px;margin:8px 0}.muted{color:#8792a3}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:#090b0f;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:20px}.metric{font-size:30px;font-weight:750;margin-top:8px}.section{margin-top:18px}.two{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}.bar{height:9px;background:#171b22;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#6f8cff}.row{display:flex;justify-content:space-between;gap:16px;margin:14px 0}.risk{font-size:11px;text-transform:uppercase;letter-spacing:1px}.risk.high{color:#ff7b7b}.risk.medium{color:#f4c96a}.risk.low{color:#61d6a1}.signal{padding:14px 0;border-top:1px solid rgba(255,255,255,.06)}.signal:first-child{border-top:0}.empty{padding:34px;text-align:center}.back{color:#9fb0ff;text-decoration:none}@media(max-width:900px){.grid,.two{grid-template-columns:1fr 1fr}.insights-head{align-items:flex-start;flex-direction:column}}@media(max-width:620px){.grid,.two{grid-template-columns:1fr}}
`;

export default function InsightsPage(){
 const [data,setData]=useState<Data|null>(null); const [error,setError]=useState("");
 useEffect(()=>{api<Data>("/api/insights").then(setData).catch(e=>setError(e instanceof Error?e.message:"Unable to load insights."));},[]);
 if(error)return <main className="insights-page"><style>{css}</style><p className="eyebrow">INTELLIGENCE</p><h1>Insights</h1><p className="muted">{error}</p></main>;
 if(!data)return <main className="insights-page"><style>{css}</style><p className="eyebrow">INTELLIGENCE</p><h1>Insights</h1><p className="muted">Analyzing workspace signals…</p></main>;
 const o=data.overview;
 const total=Object.values(data.readiness_distribution).reduce((a,b)=>a+b,0);
 return <main className="insights-page"><style>{css}</style>
  <header className="insights-head"><div><p className="eyebrow">AGATA INTELLIGENCE</p><h1>Insights</h1><p className="muted">Patterns across readiness, evidence, projects and contractor coverage. No invented metrics — every signal comes from workspace records.</p></div><Link className="back" to="/dashboard">Back to Command Center →</Link></header>
  <section className="grid">
   <article className="card"><span className="eyebrow">READINESS</span><div className="metric">{o.average_readiness==null?"—":`${o.average_readiness}%`}</div><p className="muted">Current evaluated average</p></article>
   <article className="card"><span className="eyebrow">EVIDENCE</span><div className="metric">{o.active_evidence??0}</div><p className="muted">Active evidence items</p></article>
   <article className="card"><span className="eyebrow">RENEWAL PRESSURE</span><div className="metric">{(o.expiring_evidence??0)+(o.expired_evidence??0)}</div><p className="muted">Expiring or expired</p></article>
   <article className="card"><span className="eyebrow">EVALUATION COVERAGE</span><div className="metric">{data.signals.find(s=>s.key==="evaluation_coverage")?.value??0}%</div><p className="muted">Project / contractor pairs assessed</p></article>
  </section>
  <section className="two section">
   <article className="card"><p className="eyebrow">READINESS DISTRIBUTION</p><h2>Decision posture</h2>{total===0?<div className="empty muted">No readiness decisions recorded yet.</div>:Object.entries(data.readiness_distribution).map(([key,value])=><div className="row" key={key}><span>{key.replace("_"," ")}</span><strong>{value} <span className="muted">({Math.round(value/total*100)}%)</span></strong></div>)}</article>
   <article className="card"><p className="eyebrow">SIGNALS</p><h2>Where attention is building</h2>{data.signals.map(s=><div className="signal" key={s.key}><div className="row"><strong>{s.label}</strong><strong>{s.value}%</strong></div><div className="bar"><i style={{width:`${Math.min(100,Math.max(0,s.value))}%`}}/></div><p className="muted">{s.description}</p></div>)}</article>
  </section>
  <section className="card section"><p className="eyebrow">PROJECT RISK MAP</p><h2>Project-level posture</h2>{!data.project_risk.length?<div className="empty muted">Create a project to start generating project intelligence.</div>:data.project_risk.map(p=><div className="row" key={p.id}><div><strong>{p.name}</strong><div className="muted">{p.checks} readiness decision{p.checks===1?"":"s"}</div></div><div><strong>{p.score==null?"—":`${p.score}%`}</strong> <span className={`risk ${p.risk}`}>{p.risk}</span></div></div>)}</section>
 </main>;
}
