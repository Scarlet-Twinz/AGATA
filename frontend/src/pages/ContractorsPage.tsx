import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Contractor = { id: string; name: string; email: string | null; phone: string | null; status: string; created_at: string };
type Project = { id: string; name: string; description: string | null; status: string };
type ContractorDetail = { contractor: Contractor; documents: { id: string; name: string; document_type: string; expires_at: string | null; status: string }[]; projects: { id: string; name: string; status: string; readiness: { score: number; status: string } | null }[] };

function Icon({ name, size = 18 }: { name: "search" | "plus" | "users" | "arrow" | "mail" | "phone" | "close" | "folder"; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "plus") return <svg {...c}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if (name === "users") return <svg {...c}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5"/><path d="M18 14.5a5 5 0 0 1 2.5 4.5"/></svg>;
  if (name === "mail") return <svg {...c}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>;
  if (name === "phone") return <svg {...c}><path d="M7 3.5 10 5l-1.5 3.5a13 13 0 0 0 4.5 4.5L16.5 11l3 3-.8 3.1a2 2 0 0 1-2 1.5C10 18 6 14 4.4 7.3a2 2 0 0 1 1.5-2L7 3.5Z"/></svg>;
  if (name === "folder") return <svg {...c}><path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z"/></svg>;
  if (name === "close") return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
  return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
}

function statusLabel(value: string) { return value === "inactive" ? "Inactive" : value === "active" ? "Active" : value; }
function readinessStatus(details: ContractorDetail | null) {
  if (!details?.projects.length) return null;
  const evaluated = details.projects.map((p) => p.readiness).filter(Boolean) as { score: number; status: string }[];
  if (!evaluated.length) return null;
  if (evaluated.every((r) => r.status === "ready")) return "ready";
  if (evaluated.some((r) => r.status === "not_ready")) return "not_ready";
  return "attention";
}

export default function ContractorsPage() {
  const navigate = useNavigate();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [details, setDetails] = useState<Record<string, ContractorDetail>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
      const [contractorList, projectList] = await Promise.all([api<Contractor[]>("/api/contractors"), api<Project[]>("/api/projects")]);
      setContractors(contractorList); setProjects(projectList);
      const entries = await Promise.all(contractorList.map(async (contractor) => { try { return [contractor.id, await api<ContractorDetail>(`/api/contractors/${contractor.id}`)] as const; } catch { return null; } }));
      setDetails(Object.fromEntries(entries.filter((entry): entry is readonly [string, ContractorDetail] => entry !== null)));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load contractors."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return value ? contractors.filter((c) => `${c.name} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(value)) : contractors;
  }, [contractors, query]);

  async function createContractor(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true); setError("");
      await api("/api/contractors", { method: "POST", body: JSON.stringify({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null }) });
      setName(""); setEmail(""); setPhone(""); setShowCreate(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create contractor."); }
    finally { setSaving(false); }
  }

  return <>
    <style>{styles}</style>
    <section className="contractors-page">
      <header className="contractors-header"><div><span className="contractors-eyebrow">WORK · CONTRACTORS</span><h1>Contractors</h1><p>Manage the people and companies whose evidence determines project readiness.</p></div><button className="contractors-primary" type="button" onClick={() => setShowCreate(true)}><Icon name="plus" size={15}/> New contractor</button></header>
      {error && <div className="contractors-error" role="alert">{error}</div>}
      <section className="contractors-toolbar"><label className="contractors-search"><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contractors" aria-label="Search contractors"/></label><span className="contractors-count">{filtered.length} {filtered.length === 1 ? "contractor" : "contractors"}</span></section>
      <section className="contractors-panel">
        <div className="contractors-head"><span>Contractor</span><span>Evidence</span><span>Projects</span><span>Readiness</span><span>Status</span><span aria-hidden="true"/></div>
        {loading ? <div className="contractors-state"><div className="contractors-spinner"/><span>Loading contractor workspace…</span></div> : filtered.length === 0 ? <div className="contractors-empty"><div className="contractors-empty-icon"><Icon name="users" size={22}/></div><strong>{contractors.length ? "No matching contractors" : "No contractors yet"}</strong><span>{contractors.length ? "Try a different search term." : "Add your first contractor to start connecting evidence and readiness."}</span>{!contractors.length && <button className="contractors-secondary" type="button" onClick={() => setShowCreate(true)}>Add first contractor</button>}</div> : <div className="contractors-list">{filtered.map((contractor) => { const detail = details[contractor.id]; const readiness = readinessStatus(detail || null); return <button className="contractors-row" key={contractor.id} type="button" onClick={() => navigate(`/contractors/${contractor.id}`)}><div className="contractors-person"><div className="contractors-avatar">{contractor.name.slice(0, 1).toUpperCase()}</div><div><strong>{contractor.name}</strong><span>{contractor.email || contractor.phone || "No contact details"}</span></div></div><div className="contractors-metric"><strong>{detail?.documents.length ?? 0}</strong><span>evidence</span></div><div className="contractors-metric"><strong>{detail?.projects.length ?? 0}</strong><span>{detail?.projects.length === 1 ? "project" : "projects"}</span></div><div>{readiness ? <span className={`contractors-readiness ${readiness}`}>{readiness === "ready" ? "Ready" : readiness === "attention" ? "Attention" : "Not ready"}</span> : <span className="contractors-neutral">Not evaluated</span>}</div><div><span className={`contractors-status ${contractor.status === "active" ? "active" : "inactive"}`}>{statusLabel(contractor.status)}</span></div><div className="contractors-arrow"><Icon name="arrow" size={15}/></div></button>; })}</div>}
      </section>
      <section className="contractors-footer"><div><span className="contractors-eyebrow">THE AGATA WORKFLOW</span><h2>Contractors are the evidence owners.</h2><p>Assign contractors to projects, collect their evidence, and use real readiness checks to see what can move forward.</p></div><div className="contractors-flow"><span>Contractors</span><Icon name="arrow" size={13}/><span>Evidence</span><Icon name="arrow" size={13}/><span>Readiness</span></div></section>
    </section>
    {showCreate && <div className="contractors-modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowCreate(false); }}><section className="contractors-modal" role="dialog" aria-modal="true" aria-labelledby="create-contractor-title"><div className="contractors-modal-head"><div><span className="contractors-eyebrow">NEW CONTRACTOR</span><h2 id="create-contractor-title">Add a contractor</h2><p>Create a profile first. Projects and evidence can be connected from the profile.</p></div><button className="contractors-close" type="button" onClick={() => setShowCreate(false)} aria-label="Close"><Icon name="close" size={17}/></button></div><form onSubmit={createContractor}><label>Contractor name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Engineering Ltd" required/></label><label>Email <span>Optional</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com"/></label><label>Phone <span>Optional</span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 …"/></label><div className="contractors-modal-actions"><button className="contractors-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="contractors-primary" type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create contractor"}</button></div></form></section></div>}
  </>;
}

const styles = `
.contractors-page{max-width:1180px;margin:0 auto;padding:40px 30px 56px;color:#e8eef7}.contractors-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:28px}.contractors-eyebrow{display:block;font-size:9px;letter-spacing:.19em;font-weight:700;color:#7f9bb8;margin-bottom:8px}.contractors-header h1{margin:0;font-size:44px;line-height:1;font-weight:760;letter-spacing:-.045em}.contractors-header p{margin:12px 0 0;color:#7890a9;font-size:13px}.contractors-primary,.contractors-secondary{border:1px solid #29455e;border-radius:10px;background:#0b1d2e;color:#dce9f7;font:600 12px/1 inherit;padding:12px 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:.18s ease}.contractors-primary:hover{border-color:#3c6b91;background:#10283d}.contractors-primary:disabled{opacity:.55;cursor:not-allowed}.contractors-secondary{background:transparent;color:#a9bdd0}.contractors-secondary:hover{border-color:#3c6b91;background:#0a1725}.contractors-error{border:1px solid #6b3941;background:#29171c;color:#e9b5bc;border-radius:10px;padding:11px 13px;margin-bottom:16px;font-size:12px}.contractors-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}.contractors-search{width:min(420px,100%);height:42px;border:1px solid #1d3449;border-radius:10px;background:#07111d;display:flex;align-items:center;gap:10px;padding:0 13px;color:#607b94}.contractors-search:focus-within{border-color:#315d83;box-shadow:0 0 0 3px rgba(55,104,150,.12)}.contractors-search input{border:0;outline:0;background:transparent;color:#dce8f4;width:100%;font:500 12px/1.2 inherit}.contractors-search input::placeholder{color:#526b83}.contractors-count{font-size:11px;color:#637c94}.contractors-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;overflow:hidden}.contractors-head,.contractors-row{display:grid;grid-template-columns:minmax(0,1.7fr) 100px 100px 120px 90px 30px;align-items:center;column-gap:16px}.contractors-head{min-height:46px;padding:0 18px;border-bottom:1px solid #192c3e;color:#5f7890;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}.contractors-row{width:100%;box-sizing:border-box;min-height:82px;padding:13px 18px;border:0;border-bottom:1px solid #142638;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.contractors-row:last-child{border-bottom:0}.contractors-row:hover{background:#08131f}.contractors-person{display:flex;align-items:center;gap:12px;min-width:0}.contractors-avatar{width:35px;height:35px;flex:none;border:1px solid #28445c;border-radius:10px;background:#081827;display:grid;place-items:center;color:#8fb4d5;font-size:12px;font-weight:700}.contractors-person>div:last-child{min-width:0}.contractors-person strong{display:block;color:#dfe8f1;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contractors-person span{display:block;color:#637d95;font-size:10px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contractors-metric strong{color:#dbe7f2;font-size:13px;margin-right:5px}.contractors-metric span{color:#607a92;font-size:10px}.contractors-readiness,.contractors-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:650}.contractors-readiness.ready{border:1px solid #28583f;background:#0a2419;color:#6fd59d}.contractors-readiness.attention{border:1px solid #5b4b25;background:#241f0d;color:#e3c56e}.contractors-readiness.not_ready{border:1px solid #63363d;background:#27151a;color:#e39ba5}.contractors-neutral{color:#5f7890;font-size:10px}.contractors-status.active{border:1px solid #284b65;background:#091c2d;color:#83afd2}.contractors-status.inactive{border:1px solid #3a4047;background:#16191d;color:#89939e}.contractors-arrow{color:#64809a;display:flex;justify-content:flex-end}.contractors-row:hover .contractors-arrow{color:#9bb9d3}.contractors-state{min-height:310px;display:flex;align-items:center;justify-content:center;gap:10px;color:#69829a;font-size:12px}.contractors-spinner{width:16px;height:16px;border:2px solid #20394f;border-top-color:#78a9d1;border-radius:50%;animation:contractor-spin .8s linear infinite}@keyframes contractor-spin{to{transform:rotate(360deg)}}.contractors-empty{min-height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.contractors-empty-icon{width:48px;height:48px;border:1px solid #28445c;border-radius:12px;background:#081827;display:grid;place-items:center;color:#79a6ce;margin-bottom:13px}.contractors-empty strong{font-size:13px;color:#dce6ef}.contractors-empty span{max-width:410px;margin:7px 0 16px;color:#667f97;font-size:11px}.contractors-footer{margin-top:18px;border:1px solid #1b3044;border-radius:14px;background:#07111c;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:28px}.contractors-footer h2{margin:0;color:#dce6f0;font-size:17px;letter-spacing:-.02em}.contractors-footer p{margin:7px 0 0;color:#667f97;font-size:11px;max-width:650px}.contractors-flow{display:flex;align-items:center;gap:9px;white-space:nowrap;color:#86a4bd;font-size:10px}.contractors-flow svg{color:#4c6982}.contractors-modal-backdrop{position:fixed;inset:0;background:rgba(1,6,11,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:1000}.contractors-modal{width:min(560px,100%);border:1px solid #29445b;border-radius:15px;background:#07111d;box-shadow:0 28px 80px rgba(0,0,0,.5);overflow:hidden}.contractors-modal-head{padding:22px 24px 18px;border-bottom:1px solid #1b3042;display:flex;justify-content:space-between;gap:20px}.contractors-modal h2{margin:0;color:#edf3f9;font-size:22px;letter-spacing:-.025em}.contractors-modal p{margin:8px 0 0;color:#6c859d;font-size:11px}.contractors-close{width:34px;height:34px;border:1px solid #29445b;border-radius:9px;background:#091827;color:#7d96ad;display:grid;place-items:center;cursor:pointer}.contractors-modal form{padding:22px 24px 24px;display:grid;gap:16px}.contractors-modal label{display:grid;gap:8px;color:#b8cadb;font-size:11px;font-weight:650}.contractors-modal label span{font-weight:400;color:#637c93;margin-left:3px}.contractors-modal input{width:100%;box-sizing:border-box;border:1px solid #20394e;border-radius:9px;background:#050d16;color:#e0eaf3;outline:0;padding:12px;font:500 12px/1.4 inherit}.contractors-modal input:focus{border-color:#3a6589;box-shadow:0 0 0 3px rgba(61,109,151,.1)}.contractors-modal-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:2px}@media(max-width:900px){.contractors-head,.contractors-row{grid-template-columns:minmax(0,1fr) 80px 90px 28px}.contractors-head span:nth-child(4),.contractors-head span:nth-child(5),.contractors-row>div:nth-child(4),.contractors-row>div:nth-child(5){display:none}}@media(max-width:650px){.contractors-page{padding:26px 16px 42px}.contractors-header{align-items:flex-start;flex-direction:column}.contractors-header h1{font-size:36px}.contractors-head{display:none}.contractors-row{grid-template-columns:minmax(0,1fr) 70px 20px;column-gap:10px;padding:14px}.contractors-row>div:nth-child(4),.contractors-row>div:nth-child(5){display:none}.contractors-metric{text-align:right}.contractors-person span{max-width:calc(100vw - 190px)}.contractors-footer{flex-direction:column;align-items:flex-start}.contractors-flow{white-space:normal}}
`;
