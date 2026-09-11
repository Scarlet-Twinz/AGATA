import { useEffect, useState } from "react";
import { api } from "../lib/api";

const css = `
.settings-page{max-width:1220px;margin:0 auto;padding:32px;color:#eef2f7}
.settings-head{margin-bottom:26px}.settings-head h1{margin:8px 0 6px;font-size:30px}.eyebrow{font-size:11px;letter-spacing:1.8px;color:#7f8b9d;font-weight:700}.muted{color:#8792a3;line-height:1.55}
.settings-layout{display:grid;grid-template-columns:235px 1fr;gap:22px}.tabs{display:grid;align-content:start;gap:4px;position:sticky;top:24px;height:max-content}.tab{background:transparent;border:1px solid transparent;color:#9aa6b7;text-align:left;padding:12px 14px;border-radius:10px;cursor:pointer;font-weight:600}.tab:hover{background:#0b0e13;color:#dce3ed}.tab.active{background:#10141b;border-color:rgba(255,255,255,.09);color:#fff}.tab small{display:block;font-size:10px;font-weight:400;color:#667386;margin-top:3px}
.panel{background:#090b0f;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px;margin-bottom:14px}.panel h2{margin:7px 0;font-size:20px}.panel h3{margin:0 0 5px;font-size:14px}.panel-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;border-bottom:1px solid rgba(255,255,255,.07);padding-bottom:18px;margin-bottom:4px}
.field{display:grid;gap:7px;margin-top:17px}.field label{font-size:12px;color:#aab4c3;font-weight:650}.field input,.field select{background:#0d1016;color:#fff;border:1px solid rgba(255,255,255,.1);padding:11px 12px;border-radius:10px;outline:none}.field input:focus,.field select:focus{border-color:rgba(113,135,255,.65)}.field input[readonly]{color:#7e8999}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.save{margin-top:19px;background:#e8edf5;color:#07090d;border:0;border-radius:10px;padding:11px 16px;font-weight:750;cursor:pointer}.save:disabled{opacity:.55;cursor:default}.notice{margin-top:14px;padding:11px 13px;border-radius:10px;background:#0d1513;border:1px solid rgba(50,220,166,.18);color:#9ee8cf;font-size:12px}.error{margin-top:14px;padding:11px 13px;border-radius:10px;background:#17100f;border:1px solid rgba(255,110,100,.18);color:#ffb0a8;font-size:12px}
.row{display:flex;justify-content:space-between;gap:20px;padding:15px 0;border-top:1px solid rgba(255,255,255,.06)}.row:first-child{border-top:0}.status{font-size:11px;color:#9aa6b7}.switch{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-top:1px solid rgba(255,255,255,.06)}.switch:first-of-type{border-top:0}.switch strong{font-size:13px}.badge{display:inline-flex;padding:5px 8px;border-radius:99px;background:#151a23;color:#aeb9c9;font-size:10px;text-transform:uppercase;letter-spacing:.8px;font-weight:700}
@media(max-width:800px){.settings-layout{grid-template-columns:1fr}.tabs{position:static;display:flex;overflow:auto}.tab{min-width:max-content}.grid2{grid-template-columns:1fr}}
`;

type SettingsData={company?:{id:string;name:string};user?:{id:string;name:string;email:string}};

const sections:[string,string,string][]=[
 ["workspace","Workspace","Company identity and workspace administration"],
 ["account","Account","Your profile and account information"],
 ["notifications","Notifications","Personal delivery preferences"],
 ["intelligence","Intelligence","Rumi and AI behavior"],
 ["security","Security","Authentication and access controls"],
];

export default function SettingsPage(){
 const [data,setData]=useState<SettingsData|null>(null);
 const [companyName,setCompanyName]=useState("");
 const [fullName,setFullName]=useState("");
 const [tab,setTab]=useState("workspace");
 const [saving,setSaving]=useState(false);
 const [saved,setSaved]=useState("");
 const [error,setError]=useState("");

 useEffect(()=>{api<SettingsData>("/api/workspace/profile").then(d=>{setData(d);setCompanyName(d.company?.name||"");setFullName(d.user?.name||"")}).catch(e=>setError(e instanceof Error?e.message:"Unable to load settings."));},[]);

 async function saveWorkspace(){
   if(!companyName.trim()||!fullName.trim()) return;
   try{setSaving(true);setError("");const next=await api<SettingsData>("/api/workspace/profile",{method:"PATCH",body:JSON.stringify({company_name:companyName.trim(),full_name:fullName.trim()})});setData(next);setSaved("Changes saved to the AGATA workspace.");window.setTimeout(()=>setSaved(""),3000);}catch(e){setError(e instanceof Error?e.message:"Unable to save settings.");}finally{setSaving(false);}
 }

 return <main className="settings-page"><style>{css}</style>
  <header className="settings-head"><p className="eyebrow">ADMINISTRATION</p><h1>Settings</h1><p className="muted">Manage your profile, organization, workspace behavior, notifications, intelligence and security.</p></header>
  <div className="settings-layout">
   <nav className="tabs" aria-label="Settings sections">{sections.map(([id,label,desc])=><button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>{setTab(id);setError("")}}>{label}<small>{desc}</small></button>)}</nav>
   <section>
    {tab==="workspace"&&<>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">ORGANIZATION</p><h2>Company information</h2><p className="muted">This identity is used across your AGATA workspace and operational surfaces.</p></div><span className="badge">Admin</span></div>
       <div className="grid2"><div className="field"><label>Company / organization name</label><input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Your company name"/></div><div className="field"><label>Workspace ID</label><input readOnly value={data?.company?.id||""}/></div></div>
       <button className="save" disabled={saving} onClick={saveWorkspace}>{saving?"Saving…":"Save changes"}</button>{saved&&<div className="notice">{saved}</div>}{error&&<div className="error">{error}</div>}
      </article>
      <article className="panel"><div className="panel-head"><div><p className="eyebrow">WORKSPACE</p><h2>Workspace behavior</h2><p className="muted">Core AGATA principles are enforced by the product rather than being cosmetic switches.</p></div></div>
       <div className="row"><div><strong>Evidence before opinion</strong><div className="muted">Readiness remains grounded in recorded evidence and deterministic checks.</div></div><span className="status">Enforced</span></div>
       <div className="row"><div><strong>Workspace-scoped intelligence</strong><div className="muted">Rumi receives workspace context and does not replace the readiness engine.</div></div><span className="status">Enforced</span></div>
      </article>
    </>}
    {tab==="account"&&<article className="panel"><div className="panel-head"><div><p className="eyebrow">MY ACCOUNT</p><h2>Profile</h2><p className="muted">Update the identity shown to your workspace team.</p></div></div>
      <div className="grid2"><div className="field"><label>Full name</label><input value={fullName} onChange={e=>setFullName(e.target.value)}/></div><div className="field"><label>Email address</label><input readOnly value={data?.user?.email||""}/></div></div>
      <div className="field"><label>Account ID</label><input readOnly value={data?.user?.id||""}/></div><button className="save" disabled={saving} onClick={saveWorkspace}>{saving?"Saving…":"Save profile"}</button>{saved&&<div className="notice">{saved}</div>}{error&&<div className="error">{error}</div>}
    </article>}
    {tab==="notifications"&&<article className="panel"><div className="panel-head"><div><p className="eyebrow">PERSONAL PREFERENCES</p><h2>Notifications</h2><p className="muted">Notifications are generated by AGATA's live workspace events. These controls describe how you receive them; they do not duplicate the Notifications inbox.</p></div></div>
      {[['Readiness changes','Receive updates when readiness status changes for work assigned to you.'],['Evidence expiration','Receive reminders when evidence you own approaches expiration.'],['Attention items','Receive alerts for actionable workspace conditions.'],['Security events','Receive account and authentication alerts.']].map(([title,desc])=><div className="switch" key={title}><div><strong>{title}</strong><div className="muted">{desc}</div></div><span className="status">In-app · enabled</span></div>)}
      <div className="row"><div><strong>Email delivery</strong><div className="muted">Email delivery is not connected yet, so AGATA does not claim that email alerts are being sent.</div></div><span className="badge">Not connected</span></div>
    </article>}
    {tab==="intelligence"&&<article className="panel"><div className="panel-head"><div><p className="eyebrow">RUMI</p><h2>Intelligence configuration</h2><p className="muted">Rumi is the intelligence layer for explaining and navigating workspace information.</p></div><span className="badge">Grounded</span></div>
      <div className="row"><div><strong>Workspace context</strong><div className="muted">Rumi can use current AGATA workspace data when answering questions.</div></div><span className="status">Enabled</span></div>
      <div className="row"><div><strong>Readiness authority</strong><div className="muted">Deterministic readiness results remain the source of truth.</div></div><span className="status">Enforced</span></div>
      <div className="row"><div><strong>Model provider</strong><div className="muted">Configured through the AGATA backend environment.</div></div><span className="status">Backend configured</span></div>
    </article>}
    {tab==="security"&&<article className="panel"><div className="panel-head"><div><p className="eyebrow">ACCESS CONTROL</p><h2>Security</h2><p className="muted">Security controls that are currently real, with production-grade identity controls clearly separated from the development foundation.</p></div></div>
      <div className="row"><div><strong>Authenticated session</strong><div className="muted">Your account is authenticated through the AGATA API.</div></div><span className="status">Active</span></div>
      <div className="row"><div><strong>Password management</strong><div className="muted">Password change and reset flows are not exposed here until the production identity flow is connected.</div></div><span className="badge">Coming with identity</span></div>
      <div className="row"><div><strong>API keys</strong><div className="muted">API key administration belongs here once external integrations are enabled.</div></div><span className="badge">Not configured</span></div>
      <div className="row"><div><strong>Audit trail</strong><div className="muted">Workspace activity is recorded in the dedicated Audit Trail area.</div></div><span className="status">Separate module</span></div>
    </article>}
   </section>
  </div>
 </main>;
}
