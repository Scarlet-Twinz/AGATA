import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Project = { id: string; name: string; description: string | null; status: string };
type Requirement = { id: string; name: string; description: string | null };
type Contractor = { id: string; name: string; email: string | null; phone: string | null; status: string };
type Document = { id: string; contractor_id: string | null; name: string; document_type: string; expires_at: string | null; status: string; created_at: string };
type Readiness = { project_id: string; contractor_id: string; score: number; status: string; explanation: string; missing_requirements: string[] };

type IconName = "arrow" | "back" | "plus" | "check" | "alert" | "file" | "users" | "folder" | "close";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "arrow") return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
  if (name === "back") return <svg {...c}><path d="M19 12H6"/><path d="m11 6-6 6 6 6"/></svg>;
  if (name === "plus") return <svg {...c}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if (name === "check") return <svg {...c}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "alert") return <svg {...c}><path d="m12 4 9 16H3L12 4Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  if (name === "file") return <svg {...c}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/></svg>;
  if (name === "users") return <svg {...c}><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5"/><path d="M18 14.5a5 5 0 0 1 2.5 4.5"/></svg>;
  if (name === "folder") return <svg {...c}><path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z"/></svg>;
  return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
}

function statusLabel(value: string | null) {
  if (value === "ready") return "Ready";
  if (value === "attention") return "Attention";
  if (value === "not_ready") return "Not ready";
  return "Not evaluated";
}
function statusClass(value: string | null) {
  if (value === "ready") return "ready";
  if (value === "attention") return "attention";
  if (value === "not_ready") return "not-ready";
  return "neutral";
}
function dateLabel(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [availableRequirements, setAvailableRequirements] = useState<Requirement[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [checks, setChecks] = useState<Record<string, Readiness>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [showRequirementPicker, setShowRequirementPicker] = useState(false);

  async function load() {
    if (!projectId) return;
    try {
      setLoading(true);
      setError("");
      const [projectList, projectRequirements, allRequirements, allContractors, allDocuments] = await Promise.all([
        api<Project[]>("/api/projects"),
        api<Requirement[]>(`/api/projects/${projectId}/requirements`),
        api<Requirement[]>("/api/requirements"),
        api<Contractor[]>("/api/contractors"),
        api<Document[]>("/api/documents"),
      ]);
      const found = projectList.find((item) => item.id === projectId) ?? null;
      if (!found) throw new Error("Project not found.");
      setProject(found);
      setRequirements(projectRequirements);
      setAvailableRequirements(allRequirements);
      setContractors(allContractors);
      setDocuments(allDocuments);

      const evaluated = allContractors.filter((contractor) => allDocuments.some((doc) => doc.contractor_id === contractor.id) || false);
      const resultEntries = await Promise.all(evaluated.map(async (contractor) => {
        try {
          const result = await api<Readiness>(`/api/projects/${projectId}/contractors/${contractor.id}/readiness`);
          return [contractor.id, result] as const;
        } catch { return null; }
      }));
      setChecks(Object.fromEntries(resultEntries.filter((entry): entry is readonly [string, Readiness] => entry !== null)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this project.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [projectId]);

  const attachedIds = useMemo(() => new Set(requirements.map((item) => item.id)), [requirements]);
  const unconfiguredRequirements = useMemo(() => availableRequirements.filter((item) => !attachedIds.has(item.id)), [availableRequirements, attachedIds]);
  const evaluatedCount = Object.keys(checks).length;
  const readyCount = Object.values(checks).filter((check) => check.status === "ready").length;
  const attentionCount = Object.values(checks).filter((check) => check.status === "attention").length;
  const notReadyCount = Object.values(checks).filter((check) => check.status === "not_ready").length;
  const averageScore = evaluatedCount ? Math.round(Object.values(checks).reduce((sum, check) => sum + check.score, 0) / evaluatedCount) : null;

  async function attachRequirement(requirementId: string) {
    if (!projectId) return;
    try {
      setBusyId(requirementId);
      setError("");
      await api(`/api/projects/${projectId}/requirements`, { method: "POST", body: JSON.stringify({ requirement_id: requirementId }) });
      setShowRequirementPicker(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to attach requirement.");
    } finally { setBusyId(""); }
  }

  async function evaluate(contractorId: string) {
    if (!projectId) return;
    try {
      setBusyId(contractorId);
      setError("");
      const result = await api<Readiness>(`/api/projects/${projectId}/contractors/${contractorId}/readiness`, { method: "POST" });
      setChecks((current) => ({ ...current, [contractorId]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to evaluate contractor readiness.");
    } finally { setBusyId(""); }
  }

  if (loading) return <><style>{detailStyles}</style><section className="project-detail-state"><div className="detail-spinner"/><span>Loading project workspace…</span></section></>;
  if (error && !project) return <><style>{detailStyles}</style><section className="project-detail-state"><Icon name="alert" size={24}/><h2>We couldn't load this project.</h2><p>{error}</p><Link to="/projects" className="detail-secondary">Back to projects</Link></section></>;
  if (!project) return null;

  return <>
    <style>{detailStyles}</style>
    <section className="project-detail-page">
      <div className="project-detail-breadcrumb"><Link to="/projects"><Icon name="back" size={15}/> Projects</Link><span>/</span><span>{project.name}</span></div>
      <header className="project-detail-header">
        <div>
          <span className="detail-eyebrow">PROJECT WORKSPACE</span>
          <div className="detail-title-line"><h1>{project.name}</h1><span className={`detail-status ${project.status === "active" ? "active" : "inactive"}`}>{project.status === "active" ? "Active" : project.status}</span></div>
          <p>{project.description || "No project description yet. Define requirements and evaluate contractors for this work."}</p>
        </div>
        <Link to="/projects" className="detail-secondary">All projects</Link>
      </header>

      {error && <div className="detail-error" role="alert">{error}</div>}

      <section className="detail-summary-grid">
        <article className="detail-summary-card"><span>Requirements</span><strong>{requirements.length}</strong><small>Attached to this project</small></article>
        <article className="detail-summary-card"><span>Evaluated</span><strong>{evaluatedCount}</strong><small>Contractor readiness checks</small></article>
        <article className="detail-summary-card"><span>Readiness</span><strong>{averageScore == null ? "—" : `${averageScore}%`}</strong><small>{averageScore == null ? "No evaluation yet" : "Average evaluated score"}</small></article>
        <article className="detail-summary-card"><span>Evidence</span><strong>{documents.length}</strong><small>Workspace evidence records</small></article>
      </section>

      <div className="detail-main-grid">
        <main className="detail-primary">
          <section className="detail-panel">
            <div className="detail-panel-head"><div><span className="detail-eyebrow">PROJECT DEFINITION</span><h2>Requirements</h2><p>Define what a contractor must satisfy before this project is considered ready.</p></div><button className="detail-primary-button" type="button" onClick={() => setShowRequirementPicker(true)}><Icon name="plus" size={15}/> Add requirement</button></div>
            {requirements.length === 0 ? <div className="detail-empty"><div className="detail-empty-icon"><Icon name="file" size={22}/></div><strong>No requirements attached</strong><span>Start by adding requirements from your workspace library.</span><button className="detail-secondary" type="button" onClick={() => setShowRequirementPicker(true)}>Add first requirement</button></div> : <div className="requirement-list">{requirements.map((requirement) => <div className="requirement-item" key={requirement.id}><div className="requirement-icon"><Icon name="check" size={15}/></div><div><strong>{requirement.name}</strong><span>{requirement.description || "No requirement description."}</span></div></div>)}</div>}
          </section>

          <section className="detail-panel">
            <div className="detail-panel-head"><div><span className="detail-eyebrow">CONTRACTOR EVALUATION</span><h2>Contractors</h2><p>Evaluate a contractor against this project's actual requirements and evidence.</p></div><Link className="detail-text-link" to="/contractors">Manage contractors <Icon name="arrow" size={13}/></Link></div>
            {contractors.length === 0 ? <div className="detail-empty compact"><div className="detail-empty-icon"><Icon name="users" size={22}/></div><strong>No contractors yet</strong><span>Add a contractor in the Contractors workspace before evaluating readiness.</span></div> : <div className="contractor-list">{contractors.map((contractor) => { const result = checks[contractor.id]; return <div className="contractor-item" key={contractor.id}><div className="contractor-main"><div className="contractor-avatar">{contractor.name.slice(0,1).toUpperCase()}</div><div><strong>{contractor.name}</strong><span>{contractor.email || contractor.phone || "No contact details"}</span></div></div><div className="contractor-readiness">{result ? <><strong>{result.score}%</strong><span className={`readiness-chip ${statusClass(result.status)}`}>{statusLabel(result.status)}</span></> : <span className="not-evaluated">Not evaluated</span>}</div><button className="evaluate-button" type="button" disabled={busyId === contractor.id} onClick={() => void evaluate(contractor.id)}>{busyId === contractor.id ? "Checking…" : result ? "Re-check" : "Evaluate"}</button></div>; })}</div>}
          </section>
        </main>

        <aside className="detail-sidebar">
          <section className="detail-panel readiness-card"><div className="detail-eyebrow">READINESS SNAPSHOT</div><div className="readiness-big">{averageScore == null ? "—" : `${averageScore}%`}</div><p>{evaluatedCount ? "Based on evaluated contractors in this project." : "Evaluate a contractor to generate a project readiness picture."}</p><div className="readiness-breakdown"><span><i className="dot ready"/>Ready <b>{readyCount}</b></span><span><i className="dot attention"/>Attention <b>{attentionCount}</b></span><span><i className="dot not-ready"/>Not ready <b>{notReadyCount}</b></span></div><Link to="/readiness" className="detail-wide-link">Open readiness <Icon name="arrow" size={13}/></Link></section>
          <section className="detail-panel"><div className="detail-eyebrow">EVIDENCE</div><h2 className="side-title">Workspace evidence</h2><p className="side-copy">Evidence belongs to contractors and can satisfy this project's requirements when it is valid and mapped.</p>{documents.length === 0 ? <div className="side-empty"><Icon name="file" size={18}/><span>No evidence records yet.</span></div> : <div className="evidence-mini-list">{documents.slice(0,5).map((document) => <div className="evidence-mini" key={document.id}><div className="evidence-mini-icon"><Icon name="file" size={14}/></div><div><strong>{document.name}</strong><span>{document.document_type} · {dateLabel(document.expires_at)}</span></div></div>)}</div>}<Link to="/evidence" className="detail-wide-link">Open evidence <Icon name="arrow" size={13}/></Link></section>
        </aside>
      </div>
    </section>

    {showRequirementPicker && <div className="detail-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowRequirementPicker(false); }}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="requirement-picker-title"><div className="detail-modal-head"><div><span className="detail-eyebrow">PROJECT REQUIREMENTS</span><h2 id="requirement-picker-title">Add a requirement</h2><p>Choose an existing requirement from your workspace library.</p></div><button className="detail-close" type="button" onClick={() => setShowRequirementPicker(false)} aria-label="Close"><Icon name="close" size={17}/></button></div>{unconfiguredRequirements.length === 0 ? <div className="picker-empty"><strong>Everything is already attached</strong><span>Create another requirement in the Requirements workspace when we build it next.</span></div> : <div className="picker-list">{unconfiguredRequirements.map((requirement) => <button className="picker-item" key={requirement.id} type="button" disabled={busyId === requirement.id} onClick={() => void attachRequirement(requirement.id)}><div><strong>{requirement.name}</strong><span>{requirement.description || "No description."}</span></div><Icon name="plus" size={15}/></button>)}</div>}</section></div>}
  </>;
}

const detailStyles = `
.project-detail-page{max-width:1420px;margin:0 auto;padding:34px 30px 70px;color:#e8eef5}.project-detail-breadcrumb{display:flex;align-items:center;gap:7px;margin-bottom:25px;color:#4f657a;font-size:9px}.project-detail-breadcrumb a{display:flex;align-items:center;gap:5px;color:#7792aa;text-decoration:none}.project-detail-breadcrumb a:hover{color:#acd4f3}.project-detail-header{display:flex;align-items:flex-end;justify-content:space-between;gap:25px;margin-bottom:27px}.detail-eyebrow{display:block;color:#54718d;font-size:8px;font-weight:800;letter-spacing:.16em}.detail-title-line{display:flex;align-items:center;gap:11px;margin:9px 0 8px}.detail-title-line h1{margin:0;font-size:clamp(30px,3.5vw,48px);line-height:1;letter-spacing:-.05em}.detail-project-header p,.project-detail-header p{max-width:680px;margin:0;color:#6c7f92;font-size:11px;line-height:1.7}.detail-status{display:inline-flex;align-items:center;min-height:22px;padding:0 8px;border-radius:99px;font-size:8px;font-weight:800}.detail-status.active{border:1px solid rgba(113,214,163,.18);background:rgba(48,129,91,.11);color:#71d6a3}.detail-status.inactive{border:1px solid #273746;background:#101821;color:#74879a}.detail-secondary{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 13px;border:1px solid #22374a;border-radius:9px;background:#0b131c;color:#8ca0b3;font-size:9px;font-weight:750;text-decoration:none;white-space:nowrap}.detail-secondary:hover{border-color:#35536d;color:#c9d9e8}.detail-error{margin-bottom:14px;padding:11px 13px;border:1px solid rgba(237,139,139,.25);border-radius:10px;background:rgba(100,35,35,.12);color:#e9aaaa;font-size:10px}.detail-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}.detail-summary-card{min-height:100px;padding:17px;border:1px solid #172532;border-radius:12px;background:#090f16}.detail-summary-card span{display:block;color:#64788c;font-size:9px}.detail-summary-card strong{display:block;margin-top:9px;font-size:25px;letter-spacing:-.04em}.detail-summary-card small{display:block;margin-top:5px;color:#4e6276;font-size:8px}.detail-main-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,.7fr);gap:12px}.detail-primary,.detail-sidebar{display:grid;gap:12px;align-content:start}.detail-panel{border:1px solid #172532;border-radius:13px;background:#090f16;overflow:hidden}.detail-panel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:19px 19px 16px;border-bottom:1px solid #14212d}.detail-panel h2{margin:7px 0 5px;font-size:17px;letter-spacing:-.025em}.detail-panel-head p{margin:0;color:#5d7084;font-size:9px;line-height:1.55}.detail-primary-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:37px;padding:0 12px;border:1px solid #315d80;border-radius:8px;background:#10283b;color:#c5e4fb;font-size:9px;font-weight:800;white-space:nowrap;cursor:pointer}.detail-primary-button:hover{background:#14354d;border-color:#4d88b6}.detail-text-link{display:flex;align-items:center;gap:5px;color:#6f9dc2;font-size:8px;text-decoration:none;white-space:nowrap}.detail-text-link:hover{color:#a5d0f2}.detail-empty{min-height:230px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;text-align:center}.detail-empty.compact{min-height:170px}.detail-empty-icon{width:46px;height:46px;display:grid;place-items:center;margin-bottom:12px;border:1px solid #23415b;border-radius:12px;background:#0d1b29;color:#79b8ef}.detail-empty strong{font-size:11px}.detail-empty span{max-width:390px;margin:6px 0 14px;color:#5d7185;font-size:9px;line-height:1.6}.requirement-list,.contractor-list{display:grid}.requirement-item{display:flex;align-items:center;gap:11px;min-height:69px;padding:0 18px;border-bottom:1px solid #121e2a}.requirement-item:last-child{border-bottom:0}.requirement-icon{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;border:1px solid rgba(82,169,133,.2);border-radius:8px;background:rgba(38,103,78,.1);color:#6bc99f}.requirement-item div:last-child{display:grid;gap:4px;min-width:0}.requirement-item strong{font-size:10px}.requirement-item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#566a7e;font-size:8px}.contractor-item{display:grid;grid-template-columns:minmax(0,1fr) 130px 78px;align-items:center;gap:15px;min-height:74px;padding:0 18px;border-bottom:1px solid #121e2a}.contractor-item:last-child{border-bottom:0}.contractor-main{display:flex;align-items:center;gap:10px;min-width:0}.contractor-avatar{width:34px;height:34px;display:grid;place-items:center;flex:0 0 34px;border:1px solid #28445c;border-radius:9px;background:#0d1b29;color:#86bce6;font-size:11px;font-weight:800}.contractor-main>div:last-child{display:grid;gap:4px;min-width:0}.contractor-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.contractor-main span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#566a7e;font-size:8px}.contractor-readiness{display:grid;gap:4px}.contractor-readiness strong{font-size:11px}.not-evaluated{color:#596e82;font-size:8px}.readiness-chip{width:max-content;display:inline-flex;align-items:center;min-height:20px;padding:0 7px;border-radius:99px;font-size:7px;font-weight:800}.readiness-chip.ready{border:1px solid rgba(113,214,163,.17);background:rgba(48,129,91,.1);color:#71d6a3}.readiness-chip.attention{border:1px solid rgba(224,180,96,.18);background:rgba(126,89,28,.1);color:#d9b16a}.readiness-chip.not-ready{border:1px solid rgba(232,120,120,.17);background:rgba(116,35,35,.1);color:#df8989}.readiness-chip.neutral{border:1px solid #273746;background:#101821;color:#72869a}.evaluate-button{height:31px;border:1px solid #233c52;border-radius:7px;background:#0c1823;color:#8fbce0;font-size:8px;font-weight:800;cursor:pointer}.evaluate-button:hover{border-color:#426f95;background:#102232}.evaluate-button:disabled{opacity:.6;cursor:wait}.readiness-card{padding:19px}.readiness-big{margin-top:10px;font-size:46px;font-weight:800;line-height:1;letter-spacing:-.055em}.readiness-card p{margin:8px 0 18px;color:#5e7185;font-size:9px;line-height:1.6}.readiness-breakdown{display:grid;gap:9px;padding:13px 0;border-top:1px solid #14212d;border-bottom:1px solid #14212d}.readiness-breakdown span{display:flex;align-items:center;gap:7px;color:#718398;font-size:8px}.readiness-breakdown b{margin-left:auto;color:#c5d3df}.dot{width:6px;height:6px;border-radius:50%}.dot.ready{background:#62c99b}.dot.attention{background:#d8b06a}.dot.not-ready{background:#dc8585}.detail-wide-link{display:flex;align-items:center;justify-content:space-between;margin-top:13px;color:#76a8d0;font-size:8px;text-decoration:none}.detail-wide-link:hover{color:#b0d7f3}.side-title{margin:7px 0 5px;font-size:14px}.side-copy{margin:0 0 15px;color:#5d7084;font-size:9px;line-height:1.6}.side-empty{display:flex;align-items:center;gap:8px;padding:13px;border:1px dashed #203344;border-radius:9px;color:#566b80;font-size:8px}.evidence-mini-list{display:grid;gap:7px}.evidence-mini{display:flex;gap:8px;align-items:center;min-width:0}.evidence-mini-icon{width:27px;height:27px;display:grid;place-items:center;flex:0 0 27px;border:1px solid #20384e;border-radius:7px;background:#0c1823;color:#6fa6d2}.evidence-mini>div:last-child{display:grid;gap:3px;min-width:0}.evidence-mini strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px}.evidence-mini span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#52677b;font-size:7px}.detail-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:rgba(2,6,10,.74);backdrop-filter:blur(8px)}.detail-modal{width:min(540px,100%);max-height:min(650px,90vh);overflow:auto;border:1px solid #24384b;border-radius:15px;background:#0a1119;box-shadow:0 35px 100px rgba(0,0,0,.48)}.detail-modal-head{display:flex;justify-content:space-between;gap:18px;padding:22px;border-bottom:1px solid #172532}.detail-modal-head h2{margin:7px 0 5px;font-size:20px}.detail-modal-head p{margin:0;color:#63768a;font-size:9px;line-height:1.6}.detail-close{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;border:1px solid #1d3041;border-radius:8px;background:#0c141d;color:#6b8094;cursor:pointer}.picker-list{display:grid;padding:8px}.picker-item{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:13px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left;cursor:pointer}.picker-item:hover{background:#0e1924}.picker-item:disabled{opacity:.55;cursor:wait}.picker-item div{display:grid;gap:4px;min-width:0}.picker-item strong{font-size:10px}.picker-item span{color:#5a6e82;font-size:8px}.picker-item>svg{color:#6fa7d2;flex:0 0 auto}.picker-empty{padding:35px 22px;text-align:center;display:grid;gap:7px}.picker-empty strong{font-size:10px}.picker-empty span{color:#5d7084;font-size:8px;line-height:1.6}
.project-detail-state{min-height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#62758a;font-size:10px;text-align:center}.project-detail-state h2{margin:4px 0 0;color:#dbe6ef;font-size:18px}.project-detail-state p{max-width:430px;margin:0;line-height:1.6}.detail-spinner{width:25px;height:25px;border:2px solid #1c3449;border-top-color:#76b9ef;border-radius:50%;animation:project-detail-spin .8s linear infinite}@keyframes project-detail-spin{to{transform:rotate(360deg)}}
@media(max-width:980px){.project-detail-page{padding:28px 18px 55px}.project-detail-header{align-items:flex-start;flex-direction:column}.detail-summary-grid{grid-template-columns:repeat(2,1fr)}.detail-main-grid{grid-template-columns:1fr}.detail-sidebar{grid-template-columns:repeat(2,1fr)}.detail-panel-head{align-items:flex-start;flex-direction:column}.contractor-item{grid-template-columns:minmax(0,1fr) 110px 74px}}
@media(max-width:620px){.detail-summary-grid{grid-template-columns:1fr 1fr}.detail-sidebar{grid-template-columns:1fr}.contractor-item{grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:13px 14px}.contractor-readiness{display:none}.detail-title-line{align-items:flex-start;flex-direction:column;gap:8px}.detail-primary-button{width:100%}}
`;
