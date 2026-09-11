import { useEffect, useState } from "react";
import { api } from "../lib/api";

const css=`
.billing-page{max-width:1220px;margin:0 auto;padding:32px;color:#eef2f7}.eyebrow{font-size:11px;letter-spacing:1.8px;color:#7f8b9d;font-weight:700}.muted{color:#8792a3;line-height:1.55}.hero{display:flex;justify-content:space-between;gap:20px;align-items:end}.hero h1{margin:8px 0 6px;font-size:30px}.grid{display:grid;grid-template-columns:1.35fr .65fr;gap:18px;margin-top:26px}.panel{background:#090b0f;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px}.plan{border:1px solid rgba(120,145,255,.3);background:linear-gradient(145deg,#0d111b,#090b0f);border-radius:16px;padding:26px}.plan-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.plan h2{margin:8px 0}.pill,.badge{display:inline-flex;padding:6px 9px;border-radius:99px;background:#151a23;color:#aeb9c9;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:750}.state{font-size:13px;color:#aeb9c9}.section{margin-top:18px}.section h3{font-size:14px;margin:0 0 5px}.row{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-top:1px solid rgba(255,255,255,.06)}.row:first-child{border-top:0}.metric{font-size:24px;font-weight:800}.action{margin-top:20px;background:#e8edf5;color:#07090d;border:0;border-radius:10px;padding:11px 16px;font-weight:750}.bar{height:7px;background:#171b22;border-radius:99px;overflow:hidden;margin-top:9px}.bar i{display:block;height:100%;background:#7187ff}.note{padding:13px 14px;border-radius:11px;background:#0d1016;border:1px solid rgba(255,255,255,.06);font-size:12px;color:#9aa6b7;margin-top:18px}
@media(max-width:800px){.grid{grid-template-columns:1fr}.hero{align-items:flex-start;flex-direction:column}}
`;

type Summary={company?:{name:string};counts?:{projects:number;contractors:number;requirements:number;evidence:number;users:number}};

export default function BillingPage(){
 const [summary,setSummary]=useState<Summary|null>(null);const [error,setError]=useState("");
 useEffect(()=>{api<Summary>("/api/workspace/summary").then(setSummary).catch(e=>setError(e instanceof Error?e.message:"Unable to load billing information."));},[]);
 const counts=summary?.counts;const resources=(counts?.projects||0)+(counts?.contractors||0)+(counts?.requirements||0)+(counts?.evidence||0);
 return <main className="billing-page"><style>{css}</style>
  <header className="hero"><div><p className="eyebrow">COMMERCIAL CONTROL</p><h1>Billing &amp; Plan</h1><p className="muted">Subscription, usage and billing administration for this AGATA workspace.</p></div><span className="badge">Development mode</span></header>
  {error&&<div className="panel" style={{marginTop:18}}>{error}</div>}
  <div className="grid">
   <section>
    <article className="plan"><div className="plan-top"><div><span className="pill">Current plan</span><h2>AGATA Foundation</h2><p className="muted">Core workspace capabilities for projects, contractors, requirements, evidence, readiness and Rumi.</p></div><div className="state">Active</div></div><div className="note">Billing is not connected yet. AGATA intentionally does not simulate charges, payment methods, invoices, or subscription changes.</div></article>
    <article className="panel section"><p className="eyebrow">PLAN CAPABILITIES</p>{["Projects and contractor workflows","Requirements and evidence mapping","Deterministic readiness evaluation","Rumi workspace intelligence","Notifications and audit trail","Workspace analytics"].map(x=><div className="row" key={x}><span>{x}</span><strong>Included</strong></div>)}</article>
    <article className="panel section"><p className="eyebrow">BILLING STATUS</p><div className="row"><div><strong>Payment method</strong><div className="muted">No payment provider is connected.</div></div><span className="badge">Not configured</span></div><div className="row"><div><strong>Invoices</strong><div className="muted">Invoices will appear here once billing is enabled.</div></div><span className="state">None</span></div><div className="row"><div><strong>Subscription changes</strong><div className="muted">Upgrade and downgrade actions will be enabled when a billing provider is connected.</div></div><span className="badge">Unavailable</span></div></article>
   </section>
   <aside className="panel"><p className="eyebrow">WORKSPACE USAGE</p><h2>{summary?.company?.name||"AGATA Workspace"}</h2><p className="muted">Operational scale only. These figures are live workspace counts, not fabricated billing quotas.</p><div className="row"><span>Projects</span><strong>{counts?.projects??0}</strong></div><div className="row"><span>Contractors</span><strong>{counts?.contractors??0}</strong></div><div className="row"><span>Requirements</span><strong>{counts?.requirements??0}</strong></div><div className="row"><span>Evidence</span><strong>{counts?.evidence??0}</strong></div><div className="row"><span>Team members</span><strong>{counts?.users??0}</strong></div><div className="section"><span className="eyebrow">RECORDED RESOURCES</span><div className="metric">{resources}</div><div className="bar"><i style={{width:`${Math.min(100,resources)}%`}}/></div></div></aside>
  </div>
 </main>;
}
