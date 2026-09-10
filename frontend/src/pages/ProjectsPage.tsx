import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

type DashboardProject = {
  id: string;
  name: string;
  contractor_count: number;
  requirement_count: number;
  readiness_score: number | null;
  readiness_status: string | null;
  updated_at: string | null;
};

type DashboardResponse = {
  projects: DashboardProject[];
};

function Icon({ name, size = 18 }: { name: "folder" | "search" | "plus" | "arrow" | "close"; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "folder":
      return <svg {...common}><path d="M3.5 6.5A2.5 2.5 0 0 1 6 4h4l2 2h6a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 20H6a2.5 2.5 0 0 1-2.5-2.5v-11Z" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14" /><path d="M5 12h14" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M5 12h13" /><path d="m13 6 6 6-6 6" /></svg>;
    case "close":
      return <svg {...common}><path d="m7 7 10 10" /><path d="m17 7-10 10" /></svg>;
  }
}

function statusLabel(status: string | null) {
  if (status === "ready") return "Ready";
  if (status === "attention") return "Attention";
  if (status === "not_ready") return "Not ready";
  return "Not evaluated";
}

function statusClass(status: string | null) {
  if (status === "ready") return "ready";
  if (status === "attention") return "attention";
  if (status === "not_ready") return "not-ready";
  return "neutral";
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [dashboardProjects, setDashboardProjects] = useState<DashboardProject[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function loadProjects() {
    try {
      setLoading(true);
      setError("");
      const [projectResponse, dashboardResponse] = await Promise.all([
        api<Project[]>("/api/projects"),
        api<DashboardResponse>("/api/dashboard"),
      ]);
      setProjects(projectResponse);
      setDashboardProjects(dashboardResponse.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  const projectMeta = useMemo(() => {
    return new Map(dashboardProjects.map((project) => [project.id, project]));
  }, [dashboardProjects]);

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery = !normalized || `${project.name} ${project.description ?? ""}`.toLowerCase().includes(normalized);
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [projects, query, statusFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      setSaving(true);
      setError("");
      await api<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      });
      setName("");
      setDescription("");
      setShowCreate(false);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{projectsStyles}</style>
      <section className="projects-page">
        <header className="projects-header">
          <div>
            <span className="projects-eyebrow">WORK · PROJECTS</span>
            <h1>Projects</h1>
            <p>Organize the work that contractors need to be ready for.</p>
          </div>
          <button className="projects-primary" type="button" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={16} />
            New project
          </button>
        </header>

        {error && <div className="projects-error" role="alert">{error}</div>}

        <div className="projects-toolbar">
          <label className="projects-search">
            <Icon name="search" size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" />
          </label>
          <div className="projects-filters" aria-label="Project filters">
            <button className={statusFilter === "all" ? "selected" : ""} type="button" onClick={() => setStatusFilter("all")}>All</button>
            <button className={statusFilter === "active" ? "selected" : ""} type="button" onClick={() => setStatusFilter("active")}>Active</button>
          </div>
        </div>

        {loading ? (
          <div className="projects-state"><div className="projects-spinner" /><span>Loading projects…</span></div>
        ) : filteredProjects.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon"><Icon name="folder" size={24} /></div>
            <span className="projects-eyebrow">PROJECT WORKSPACE</span>
            <h2>{projects.length === 0 ? "Start with a project" : "No projects match your search"}</h2>
            <p>{projects.length === 0 ? "Create your first project, then attach the requirements that define what a contractor must satisfy." : "Try a different project name or clear the active filter."}</p>
            {projects.length === 0 && <button className="projects-primary" type="button" onClick={() => setShowCreate(true)}><Icon name="plus" size={16} /> Create project</button>}
          </div>
        ) : (
          <div className="projects-list">
            <div className="projects-list-head">
              <span>Project</span>
              <span>Requirements</span>
              <span>Evaluated</span>
              <span>Readiness</span>
              <span>Status</span>
              <span />
            </div>
            {filteredProjects.map((project) => {
              const meta = projectMeta.get(project.id);
              return (
                <Link className="project-row" to={`/projects/${project.id}`} key={project.id}>
                  <div className="project-main">
                    <div className="project-icon"><Icon name="folder" size={18} /></div>
                    <div className="project-copy">
                      <strong>{project.name}</strong>
                      <span>{project.description || "No project description yet."}</span>
                    </div>
                  </div>
                  <div className="project-value">{meta?.requirement_count ?? 0}</div>
                  <div className="project-value">{meta?.contractor_count ?? 0}</div>
                  <div className="project-readiness">
                    <strong>{meta?.readiness_score != null ? `${meta.readiness_score}%` : "—"}</strong>
                    <span>{statusLabel(meta?.readiness_status ?? null)}</span>
                  </div>
                  <div><span className={`project-status ${project.status === "active" ? "active" : "inactive"}`}>{project.status === "active" ? "Active" : project.status}</span></div>
                  <div className="project-arrow"><Icon name="arrow" size={16} /></div>
                </Link>
              );
            })}
          </div>
        )}

        <div className="projects-note">
          <div>
            <span className="projects-eyebrow">THE AGATA WORKFLOW</span>
            <strong>Projects are the starting point for readiness.</strong>
          </div>
          <span>Define requirements → evaluate contractors → review evidence → make a readiness decision.</span>
        </div>
      </section>

      {showCreate && (
        <div className="project-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowCreate(false); }}>
          <section className="project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <div className="project-modal-head">
              <div>
                <span className="projects-eyebrow">NEW PROJECT</span>
                <h2 id="create-project-title">Create a project</h2>
                <p>Give the work a clear name. Requirements and contractor readiness can be configured next.</p>
              </div>
              <button className="project-close" type="button" aria-label="Close" onClick={() => setShowCreate(false)}><Icon name="close" size={18} /></button>
            </div>
            <form className="project-form" onSubmit={handleCreate}>
              <label>
                Project name
                <input autoFocus required minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Infrastructure Upgrade" />
              </label>
              <label>
                Description <span>Optional</span>
                <textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this project about?" rows={4} />
              </label>
              <div className="project-form-actions">
                <button className="project-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="projects-primary" type="submit" disabled={saving}>{saving ? "Creating…" : "Create project"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

const projectsStyles = `
.projects-page{max-width:1420px;margin:0 auto;padding:42px 30px 72px;color:#e8eef5}
.projects-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:28px}
.projects-eyebrow{display:block;color:#54718d;font-size:8px;font-weight:800;letter-spacing:.16em}
.projects-header h1{margin:9px 0 8px;font-size:clamp(34px,4vw,52px);line-height:1;letter-spacing:-.055em}
.projects-header p{margin:0;color:#718196;font-size:13px;line-height:1.65}
.projects-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:0 15px;border:1px solid #315d80;border-radius:9px;background:#10283b;color:#c5e4fb;font-size:10px;font-weight:800;white-space:nowrap;cursor:pointer}
.projects-primary:hover{border-color:#4d88b6;background:#14354d}.projects-primary:disabled{cursor:wait;opacity:.65}
.projects-error{margin-bottom:14px;padding:12px 14px;border:1px solid rgba(237,139,139,.25);border-radius:10px;background:rgba(100,35,35,.12);color:#e9aaaa;font-size:11px;line-height:1.5}
.projects-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:12px}
.projects-search{display:flex;align-items:center;gap:9px;width:min(360px,100%);height:38px;padding:0 12px;border:1px solid #172532;border-radius:9px;background:#090f16;color:#566d82}
.projects-search input{width:100%;border:0;outline:0;background:transparent;color:#dbe6f0;font-size:11px}.projects-search input::placeholder{color:#53687c}
.projects-filters{display:flex;gap:4px;padding:3px;border:1px solid #172532;border-radius:9px;background:#080d13}.projects-filters button{min-width:55px;height:29px;border:0;border-radius:6px;background:transparent;color:#617488;font-size:9px;font-weight:750;cursor:pointer}.projects-filters button.selected{background:#142437;color:#c5e2f8}
.projects-list{overflow:hidden;border:1px solid #172532;border-radius:13px;background:#090f16;box-shadow:0 20px 55px rgba(0,0,0,.16)}
.projects-list-head,.project-row{display:grid;grid-template-columns:minmax(280px,2.2fr) .75fr .75fr 1fr .8fr 30px;align-items:center;column-gap:18px}
.projects-list-head{min-height:42px;padding:0 18px;border-bottom:1px solid #172532;color:#4e647a;font-size:8px;font-weight:800;letter-spacing:.13em;text-transform:uppercase}
.project-row{min-height:82px;padding:0 18px;border-bottom:1px solid #121e2a;color:inherit;text-decoration:none;transition:background .16s ease}.project-row:last-child{border-bottom:0}.project-row:hover{background:#0d1721}
.project-main{display:flex;align-items:center;min-width:0;gap:12px}.project-icon{width:36px;height:36px;display:grid;place-items:center;flex:0 0 36px;border:1px solid #203b54;border-radius:9px;background:#0c1a28;color:#77b7ea}.project-copy{min-width:0;display:grid;gap:5px}.project-copy strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.project-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#5d7084;font-size:9px}.project-value{color:#cbd8e5;font-size:12px;font-weight:700}.project-readiness{display:grid;gap:4px}.project-readiness strong{font-size:12px}.project-readiness span{color:#5e7184;font-size:8px}.project-status{display:inline-flex;width:max-content;align-items:center;min-height:23px;padding:0 8px;border-radius:99px;font-size:8px;font-weight:800}.project-status.active{border:1px solid rgba(113,214,163,.18);background:rgba(48,129,91,.11);color:#71d6a3}.project-status.inactive{border:1px solid #273746;background:#101821;color:#74879a}.project-arrow{display:grid;place-items:center;color:#526a80}.project-row:hover .project-arrow{color:#8dc8f4}
.projects-state,.projects-empty{min-height:360px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:1px solid #172532;border-radius:13px;background:#090f16}.projects-state{gap:11px;color:#62758a;font-size:10px}.projects-spinner{width:25px;height:25px;border:2px solid #1c3449;border-top-color:#76b9ef;border-radius:50%;animation:agata-project-spin .8s linear infinite}@keyframes agata-project-spin{to{transform:rotate(360deg)}}
.projects-empty{padding:40px}.projects-empty-icon{width:52px;height:52px;display:grid;place-items:center;margin-bottom:17px;border:1px solid #23415b;border-radius:14px;background:#0d1b29;color:#79b8ef}.projects-empty h2{margin:9px 0 7px;font-size:20px;letter-spacing:-.025em}.projects-empty p{max-width:430px;margin:0 0 18px;color:#607387;font-size:10px;line-height:1.7}
.projects-note{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:12px;padding:16px 18px;border:1px solid #172532;border-radius:12px;background:#080e14}.projects-note strong{display:block;margin-top:5px;font-size:11px}.projects-note>span{max-width:570px;color:#5f7286;font-size:9px;line-height:1.6;text-align:right}
.project-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:rgba(2,6,10,.74);backdrop-filter:blur(8px)}
.project-modal{width:min(560px,100%);border:1px solid #24384b;border-radius:16px;background:#0a1119;box-shadow:0 35px 100px rgba(0,0,0,.48)}.project-modal-head{display:flex;justify-content:space-between;gap:18px;padding:25px 25px 20px;border-bottom:1px solid #172532}.project-modal-head h2{margin:8px 0 7px;font-size:22px;letter-spacing:-.03em}.project-modal-head p{max-width:430px;margin:0;color:#63768a;font-size:10px;line-height:1.6}.project-close{width:32px;height:32px;display:grid;place-items:center;flex:0 0 32px;border:1px solid #1d3041;border-radius:8px;background:#0c141d;color:#6b8094;cursor:pointer}.project-close:hover{color:#c6d8e8;border-color:#31516c}
.project-form{display:grid;gap:18px;padding:23px 25px 25px}.project-form label{display:grid;gap:8px;color:#c6d5e2;font-size:10px;font-weight:750}.project-form label span{color:#52677c;font-weight:500}.project-form input,.project-form textarea{width:100%;box-sizing:border-box;border:1px solid #23394e;border-radius:9px;outline:0;background:#08121c;color:#e4edf5;font:inherit;font-size:11px;padding:0 12px}.project-form input{height:44px}.project-form textarea{padding:11px 12px;resize:vertical;line-height:1.55}.project-form input:focus,.project-form textarea:focus{border-color:#5b9dd5;box-shadow:0 0 0 3px rgba(91,157,213,.1)}.project-form input::placeholder,.project-form textarea::placeholder{color:#4f657a}.project-form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:2px}.project-secondary{height:40px;padding:0 14px;border:1px solid #22374a;border-radius:9px;background:#0b131c;color:#8ca0b3;font-size:10px;font-weight:750;cursor:pointer}.project-secondary:hover{color:#cbd8e5;border-color:#34516b}
@media(max-width:900px){.projects-page{padding:30px 18px 55px}.projects-header{align-items:flex-start}.projects-list-head{display:none}.project-row{grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:16px}.project-value,.project-readiness,.project-status{display:none}.project-arrow{grid-column:2;grid-row:1}.projects-note{align-items:flex-start;flex-direction:column}.projects-note>span{text-align:left}.projects-toolbar{align-items:stretch;flex-direction:column}.projects-search{width:auto}.projects-filters{width:max-content}.project-modal-head,.project-form{padding-left:18px;padding-right:18px}}
@media(max-width:560px){.projects-header{display:block}.projects-header .projects-primary{margin-top:18px}.project-copy span{display:none}.projects-empty{min-height:320px}.projects-note{display:none}}
`;
