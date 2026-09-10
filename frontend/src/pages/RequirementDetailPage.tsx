import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

type Requirement = { id: string; name: string; description: string | null };
type Project = { id: string; name: string; description: string | null; status: string };
type ProjectRequirement = { id: string; project_id: string; requirement_id: string };

type IconName = "back" | "arrow" | "plus" | "close" | "check" | "folder";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "back") return <svg {...c}><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></svg>;
  if (name === "arrow") return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
  if (name === "plus") return <svg {...c}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if (name === "close") return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
  if (name === "check") return <svg {...c}><path d="m5 12 4 4L19 6"/></svg>;
  return <svg {...c}><path d="M4 7h6l2 2h8v10H4z"/><path d="M4 7V5h6l2 2"/></svg>;
}

export default function RequirementDetailPage() {
  const { requirementId } = useParams();
  const navigate = useNavigate();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [attached, setAttached] = useState<ProjectRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");

  async function load() {
    if (!requirementId) return;
    try {
      setLoading(true);
      setError("");
      const [requirements, projectList] = await Promise.all([
        api<Requirement[]>("/api/requirements"),
        api<Project[]>("/api/projects"),
      ]);
      const current = requirements.find((item) => item.id === requirementId);
      if (!current) throw new Error("Requirement not found.");
      setRequirement(current);
      setProjects(projectList);
      const links = await Promise.all(
        projectList.map(async (project) => {
          try {
            const list = await api<Requirement[]>(`/api/projects/${project.id}/requirements`);
            return list.some((item) => item.id === requirementId)
              ? ({ project_id: project.id, requirement_id: requirementId, id: `${project.id}:${requirementId}` } as ProjectRequirement)
              : null;
          } catch {
            return null;
          }
        }),
      );
      setAttached(links.filter((item): item is ProjectRequirement => item !== null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load requirement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [requirementId]);

  const attachedIds = useMemo(() => new Set(attached.map((item) => item.project_id)), [attached]);
  const availableProjects = projects.filter((project) => !attachedIds.has(project.id));

  async function attachProject(event: React.FormEvent) {
    event.preventDefault();
    if (!requirementId || !selectedProject) return;
    try {
      setSaving(true);
      setError("");
      await api(`/api/projects/${selectedProject}/requirements`, {
        method: "POST",
        body: JSON.stringify({ requirement_id: requirementId }),
      });
      setSelectedProject("");
      setShowAttach(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to attach requirement.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <><style>{styles}</style><section className="req-detail-state">Loading requirement…</section></>;
  if (!requirement) return <><style>{styles}</style><section className="req-detail-state"><strong>Requirement unavailable</strong><button className="req-secondary" onClick={() => navigate("/requirements")}>Back to requirements</button></section></>;

  return (
    <>
      <style>{styles}</style>
      <section className="req-detail-page">
        <Link className="req-back" to="/requirements"><Icon name="back" size={16} /> Requirements</Link>
        {error && <div className="req-error" role="alert">{error}</div>}

        <header className="req-detail-header">
          <div>
            <span className="req-eyebrow">REQUIREMENT · RULE</span>
            <h1>{requirement.name}</h1>
            <p>{requirement.description || "No description provided for this requirement."}</p>
          </div>
          <button className="req-primary" type="button" onClick={() => setShowAttach(true)} disabled={!availableProjects.length}><Icon name="plus" size={15} /> Attach to project</button>
        </header>

        <div className="req-summary-grid">
          <div><span>Used in</span><strong>{attached.length}</strong><small>{attached.length === 1 ? "project" : "projects"}</small></div>
          <div><span>Library state</span><strong>Available</strong><small>Reusable rule</small></div>
          <div><span>Next layer</span><strong>Evidence</strong><small>Maps proof to this rule</small></div>
        </div>

        <section className="req-project-panel">
          <div className="req-panel-head">
            <div><span className="req-eyebrow">PROJECT COVERAGE</span><h2>Projects using this requirement</h2><p>Attach this rule to the projects where contractors must satisfy it.</p></div>
            <span className="req-panel-count">{attached.length}</span>
          </div>
          {attached.length === 0 ? (
            <div className="req-empty"><div className="req-empty-icon"><Icon name="folder" size={21} /></div><strong>Not attached to any project yet</strong><span>Attach it to a project to make this requirement part of that project's readiness workflow.</span><button className="req-secondary" onClick={() => setShowAttach(true)} disabled={!projects.length}><Icon name="plus" size={14} /> Attach requirement</button></div>
          ) : (
            <div className="req-project-list">
              {attached.map((link) => { const project = projects.find((item) => item.id === link.project_id); if (!project) return null; return <Link className="req-project-row" key={link.id} to={`/projects/${project.id}`}><div className="req-project-icon"><Icon name="folder" size={16} /></div><div><strong>{project.name}</strong><span>{project.description || "No project description."}</span></div><span className="req-project-status"><Icon name="check" size={13} /> Attached</span><Icon name="arrow" size={15} /></Link>; })}
            </div>
          )}
        </section>

        <section className="req-next-card"><div><span className="req-eyebrow">WHAT COMES NEXT</span><h2>Evidence proves the requirement.</h2><p>Once this rule is attached to a project, contractor evidence can be mapped to it and used by AGATA's readiness engine.</p></div><div className="req-next-flow"><span>Requirement</span><Icon name="arrow" size={13}/><span>Evidence</span><Icon name="arrow" size={13}/><span>Readiness</span></div></section>
      </section>

      {showAttach && <div className="req-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAttach(false); }}><section className="req-modal" role="dialog" aria-modal="true" aria-labelledby="attach-title"><div className="req-modal-head"><div><span className="req-eyebrow">PROJECT COVERAGE</span><h2 id="attach-title">Attach to a project</h2><p>Select a project where this requirement should apply.</p></div><button className="req-close" onClick={() => setShowAttach(false)} aria-label="Close"><Icon name="close" size={17}/></button></div><form onSubmit={attachProject}><label>Project<select value={selectedProject} onChange={(event) => setSelectedProject(event.target.value)} required><option value="">Choose a project…</option>{availableProjects.map((project) => <option value={project.id} key={project.id}>{project.name}</option>)}</select></label><div className="req-modal-actions"><button className="req-secondary" type="button" onClick={() => setShowAttach(false)}>Cancel</button><button className="req-primary" type="submit" disabled={saving || !selectedProject}>{saving ? "Attaching…" : "Attach requirement"}</button></div></form></section></div>}
    </>
  );
}

const styles = `
.req-detail-page{max-width:1120px;margin:0 auto;padding:34px 30px 56px;color:#e8eef7}.req-back{display:inline-flex;align-items:center;gap:7px;color:#7691a9;text-decoration:none;font-size:11px;margin-bottom:28px}.req-back:hover{color:#b6cce0}.req-eyebrow{display:block;font-size:9px;letter-spacing:.18em;font-weight:700;color:#7f9bb8;margin-bottom:8px}.req-detail-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:26px}.req-detail-header h1{margin:0;font-size:38px;line-height:1.05;letter-spacing:-.04em}.req-detail-header p{margin:10px 0 0;color:#7189a0;font-size:12px;max-width:720px}.req-primary,.req-secondary{border:1px solid #29455e;border-radius:10px;background:#0b1d2e;color:#dce9f7;font:600 12px/1 inherit;padding:12px 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.req-primary:hover{border-color:#3c6b91;background:#10283d}.req-primary:disabled,.req-secondary:disabled{opacity:.5;cursor:not-allowed}.req-secondary{background:transparent;color:#a9bdd0}.req-error{margin-bottom:18px;border:1px solid #6b3941;background:#29171c;color:#e9b5bc;border-radius:10px;padding:11px 13px;font-size:12px}.req-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}.req-summary-grid>div{border:1px solid #1b3044;border-radius:13px;background:#07111c;padding:16px 17px;min-height:80px}.req-summary-grid span{display:block;color:#637d95;font-size:9px;text-transform:uppercase;letter-spacing:.13em}.req-summary-grid strong{display:block;color:#e1eaf2;font-size:18px;margin-top:8px}.req-summary-grid small{display:block;color:#566f87;font-size:10px;margin-top:3px}.req-project-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;overflow:hidden}.req-panel-head{display:flex;justify-content:space-between;gap:20px;padding:20px 20px 17px;border-bottom:1px solid #192d40}.req-panel-head h2{margin:0;color:#e0e9f1;font-size:16px}.req-panel-head p{margin:6px 0 0;color:#637c94;font-size:10px}.req-panel-count{min-width:28px;height:28px;padding:0 8px;border:1px solid #29455e;border-radius:8px;background:#081827;color:#9ab6cf;display:grid;place-items:center;font-size:11px}.req-project-list{display:block}.req-project-row{min-height:76px;padding:12px 18px;display:grid;grid-template-columns:34px minmax(0,1fr) auto 18px;align-items:center;gap:12px;border-bottom:1px solid #142638;text-decoration:none}.req-project-row:last-child{border-bottom:0}.req-project-row:hover{background:#08131f}.req-project-icon{width:34px;height:34px;border:1px solid #28445c;border-radius:9px;background:#081827;color:#7fa9cf;display:grid;place-items:center}.req-project-row strong{display:block;color:#dfe8f1;font-size:12px}.req-project-row div:nth-child(2) span{display:block;color:#607a92;font-size:10px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.req-project-status{display:flex;align-items:center;gap:5px;color:#69d197;font-size:9px;border:1px solid #28583f;border-radius:999px;padding:5px 8px;background:#0a2419}.req-project-row>svg{color:#627f98}.req-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px}.req-empty-icon{width:48px;height:48px;border:1px solid #28445c;border-radius:12px;background:#081827;color:#79a6ce;display:grid;place-items:center;margin-bottom:13px}.req-empty strong{font-size:13px;color:#dce6ef}.req-empty span{max-width:470px;margin:7px 0 16px;color:#667f97;font-size:11px}.req-next-card{margin-top:18px;border:1px solid #1b3044;border-radius:14px;background:#07111c;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:28px}.req-next-card h2{margin:0;color:#dce6f0;font-size:17px;letter-spacing:-.02em}.req-next-card p{margin:7px 0 0;color:#667f97;font-size:11px;max-width:670px}.req-next-flow{display:flex;align-items:center;gap:9px;white-space:nowrap;color:#86a4bd;font-size:10px}.req-next-flow svg{color:#4c6982}.req-detail-state{min-height:60vh;display:flex;align-items:center;justify-content:center;gap:14px;flex-direction:column;color:#728aa1;font-size:12px}.req-modal-backdrop{position:fixed;inset:0;background:rgba(1,6,11,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:1000}.req-modal{width:min(500px,100%);border:1px solid #29445b;border-radius:15px;background:#07111d;box-shadow:0 28px 80px rgba(0,0,0,.5);overflow:hidden}.req-modal-head{padding:22px 24px 18px;border-bottom:1px solid #1b3042;display:flex;justify-content:space-between;gap:20px}.req-modal h2{margin:0;color:#edf3f9;font-size:21px}.req-modal p{margin:8px 0 0;color:#6c859d;font-size:11px}.req-close{width:34px;height:34px;border:1px solid #29445b;border-radius:9px;background:#091827;color:#7d96ad;display:grid;place-items:center;cursor:pointer}.req-modal form{padding:22px 24px 24px;display:grid;gap:18px}.req-modal label{display:grid;gap:8px;color:#b8cadb;font-size:11px;font-weight:650}.req-modal select{width:100%;box-sizing:border-box;border:1px solid #20394e;border-radius:9px;background:#050d16;color:#e0eaf3;outline:0;padding:12px;font:500 12px/1.4 inherit}.req-modal-actions{display:flex;justify-content:flex-end;gap:9px}.req-modal select:focus{border-color:#3a6589}.req-modal .req-primary:disabled{opacity:.5}
@media(max-width:760px){.req-detail-page{padding:25px 16px 42px}.req-detail-header{align-items:flex-start;flex-direction:column}.req-detail-header h1{font-size:32px}.req-primary{width:auto}.req-summary-grid{grid-template-columns:1fr}.req-project-row{grid-template-columns:34px minmax(0,1fr) 18px}.req-project-status{display:none}.req-next-card{flex-direction:column;align-items:flex-start}.req-next-flow{white-space:normal}}
`;
