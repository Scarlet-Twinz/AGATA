import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Requirement = {
  id: string;
  name: string;
  description: string | null;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
};

function Icon({ name, size = 18 }: { name: "search" | "plus" | "file" | "close" | "arrow"; size?: number }) {
  const c = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "search") return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "plus") return <svg {...c}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if (name === "file") return <svg {...c}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/></svg>;
  if (name === "arrow") return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
  return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
}

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [requirementList, projectList] = await Promise.all([
        api<Requirement[]>("/api/requirements"),
        api<Project[]>("/api/projects"),
      ]);
      setRequirements(requirementList);
      setProjects(projectList);

      const projectRequirementLists = await Promise.all(
        projectList.map(async (project) => {
          try {
            return await api<Requirement[]>(`/api/projects/${project.id}/requirements`);
          } catch {
            return [];
          }
        }),
      );
      const counts: Record<string, number> = {};
      projectRequirementLists.flat().forEach((requirement) => {
        counts[requirement.id] = (counts[requirement.id] || 0) + 1;
      });
      setUsage(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load requirements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return requirements;
    return requirements.filter((requirement) =>
      `${requirement.name} ${requirement.description || ""}`.toLowerCase().includes(value),
    );
  }, [requirements, query]);

  async function createRequirement(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      setError("");
      await api("/api/requirements", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      setName("");
      setDescription("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create requirement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{requirementsStyles}</style>
      <section className="requirements-page">
        <header className="requirements-header">
          <div>
            <span className="requirements-eyebrow">WORK · REQUIREMENTS</span>
            <h1>Requirements</h1>
            <p>Build reusable requirements that define what contractors must satisfy.</p>
          </div>
          <button className="requirements-primary-button" type="button" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={15} /> New requirement
          </button>
        </header>

        {error && <div className="requirements-error" role="alert">{error}</div>}

        <section className="requirements-toolbar">
          <label className="requirements-search">
            <Icon name="search" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search requirements" aria-label="Search requirements" />
          </label>
          <span className="requirements-count">{filtered.length} {filtered.length === 1 ? "requirement" : "requirements"}</span>
        </section>

        <section className="requirements-panel">
          <div className="requirements-table-head">
            <span>Requirement</span>
            <span>Used in</span>
            <span>State</span>
            <span aria-hidden="true" />
          </div>

          {loading ? (
            <div className="requirements-state"><div className="requirements-spinner" /><span>Loading requirement library…</span></div>
          ) : filtered.length === 0 ? (
            <div className="requirements-empty">
              <div className="requirements-empty-icon"><Icon name="file" size={22} /></div>
              <strong>{requirements.length === 0 ? "No requirements yet" : "No matching requirements"}</strong>
              <span>{requirements.length === 0 ? "Create your first reusable requirement, then attach it to projects." : "Try a different search term."}</span>
              {requirements.length === 0 && <button className="requirements-secondary-button" type="button" onClick={() => setShowCreate(true)}>Create first requirement</button>}
            </div>
          ) : (
            <div className="requirements-list">
              {filtered.map((requirement) => {
                const projectCount = usage[requirement.id] || 0;
                return (
                  <article className="requirements-row" key={requirement.id}>
                    <div className="requirements-name-cell">
                      <div className="requirements-row-icon"><Icon name="file" size={16} /></div>
                      <div>
                        <strong>{requirement.name}</strong>
                        <span>{requirement.description || "No description provided."}</span>
                      </div>
                    </div>
                    <div className="requirements-used-cell">
                      <strong>{projectCount}</strong>
                      <span>{projectCount === 1 ? "project" : "projects"}</span>
                    </div>
                    <div><span className="requirements-state-chip">Available</span></div>
                    <div className="requirements-row-arrow"><Icon name="arrow" size={15} /></div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="requirements-footer-card">
          <div>
            <span className="requirements-eyebrow">THE AGATA WORKFLOW</span>
            <h2>Define once. Reuse across projects.</h2>
            <p>Requirements form the rule layer that connects project work to contractor evidence and readiness decisions.</p>
          </div>
          <div className="requirements-flow">
            <span>Requirements</span><Icon name="arrow" size={13} /><span>Evidence</span><Icon name="arrow" size={13} /><span>Readiness</span>
          </div>
        </section>
      </section>

      {showCreate && (
        <div className="requirements-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowCreate(false); }}>
          <section className="requirements-modal" role="dialog" aria-modal="true" aria-labelledby="create-requirement-title">
            <div className="requirements-modal-head">
              <div>
                <span className="requirements-eyebrow">NEW REQUIREMENT</span>
                <h2 id="create-requirement-title">Create a requirement</h2>
                <p>Give the rule a clear name. You can reuse it across projects.</p>
              </div>
              <button className="requirements-close" type="button" onClick={() => setShowCreate(false)} aria-label="Close"><Icon name="close" size={17} /></button>
            </div>
            <form onSubmit={createRequirement}>
              <label>Requirement name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Insurance Certificate" required /></label>
              <label>Description <span>Optional</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what evidence satisfies this requirement." rows={4} /></label>
              <div className="requirements-modal-actions"><button className="requirements-secondary-button" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="requirements-primary-button" type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create requirement"}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

const requirementsStyles = `
.requirements-page{max-width:1120px;margin:0 auto;padding:40px 30px 56px;color:#e8eef7}
.requirements-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:28px}
.requirements-eyebrow{display:block;font-size:9px;letter-spacing:.19em;font-weight:700;color:#7f9bb8;margin-bottom:8px}
.requirements-header h1{margin:0;font-size:44px;line-height:1;font-weight:760;letter-spacing:-.045em}
.requirements-header p{margin:12px 0 0;color:#7890a9;font-size:13px}
.requirements-primary-button,.requirements-secondary-button{border:1px solid #29455e;border-radius:10px;background:#0b1d2e;color:#dce9f7;font:600 12px/1 inherit;padding:12px 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:.18s ease}
.requirements-primary-button:hover{border-color:#3c6b91;background:#10283d}.requirements-primary-button:disabled{opacity:.55;cursor:not-allowed}
.requirements-secondary-button{background:transparent;color:#a9bdd0}.requirements-secondary-button:hover{border-color:#3c6b91;background:#0a1725}
.requirements-error{border:1px solid #6b3941;background:#29171c;color:#e9b5bc;border-radius:10px;padding:11px 13px;margin-bottom:16px;font-size:12px}
.requirements-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px}
.requirements-search{width:min(420px,100%);height:42px;border:1px solid #1d3449;border-radius:10px;background:#07111d;display:flex;align-items:center;gap:10px;padding:0 13px;color:#607b94}
.requirements-search:focus-within{border-color:#315d83;box-shadow:0 0 0 3px rgba(55,104,150,.12)}
.requirements-search input{border:0;outline:0;background:transparent;color:#dce8f4;width:100%;font:500 12px/1.2 inherit}.requirements-search input::placeholder{color:#526b83}
.requirements-count{font-size:11px;color:#637c94}
.requirements-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;overflow:hidden}
.requirements-table-head,.requirements-row{display:grid;grid-template-columns:minmax(0,1fr) 130px 120px 34px;align-items:center;column-gap:18px}
.requirements-table-head{min-height:46px;padding:0 18px;border-bottom:1px solid #192c3e;color:#5f7890;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
.requirements-list{display:block}.requirements-row{min-height:86px;padding:14px 18px;border-bottom:1px solid #142638}.requirements-row:last-child{border-bottom:0}.requirements-row:hover{background:#08131f}
.requirements-name-cell{display:flex;align-items:center;gap:12px;min-width:0}.requirements-row-icon{width:34px;height:34px;flex:none;border:1px solid #28445c;border-radius:9px;background:#081827;display:grid;place-items:center;color:#7fa9cf}
.requirements-name-cell div:last-child{min-width:0}.requirements-name-cell strong{display:block;color:#dfe8f1;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.requirements-name-cell span{display:block;color:#637d95;font-size:10px;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.requirements-used-cell strong{display:inline-block;color:#dbe7f2;font-size:13px;margin-right:5px}.requirements-used-cell span{color:#607a92;font-size:10px}
.requirements-state-chip{display:inline-flex;padding:5px 8px;border:1px solid #28583f;border-radius:999px;background:#0a2419;color:#6fd59d;font-size:9px;font-weight:650}
.requirements-row-arrow{color:#64809a;display:flex;justify-content:flex-end}.requirements-row-arrow svg{transition:transform .18s ease}.requirements-row:hover .requirements-row-arrow svg{transform:translateX(3px);color:#9bb9d3}
.requirements-state{min-height:300px;display:flex;align-items:center;justify-content:center;gap:10px;color:#69829a;font-size:12px}.requirements-spinner{width:16px;height:16px;border:2px solid #20394f;border-top-color:#78a9d1;border-radius:50%;animation:req-spin .8s linear infinite}@keyframes req-spin{to{transform:rotate(360deg)}}
.requirements-empty{min-height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.requirements-empty-icon{width:48px;height:48px;border:1px solid #28445c;border-radius:12px;background:#081827;display:grid;place-items:center;color:#79a6ce;margin-bottom:13px}.requirements-empty strong{font-size:13px;color:#dce6ef}.requirements-empty span{max-width:410px;margin:7px 0 16px;color:#667f97;font-size:11px}
.requirements-footer-card{margin-top:18px;border:1px solid #1b3044;border-radius:14px;background:#07111c;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:28px}.requirements-footer-card h2{margin:0;color:#dce6f0;font-size:17px;letter-spacing:-.02em}.requirements-footer-card p{margin:7px 0 0;color:#667f97;font-size:11px;max-width:650px}.requirements-flow{display:flex;align-items:center;gap:9px;white-space:nowrap;color:#86a4bd;font-size:10px}.requirements-flow svg{color:#4c6982}
.requirements-modal-backdrop{position:fixed;inset:0;background:rgba(1,6,11,.72);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px;z-index:1000}.requirements-modal{width:min(560px,100%);border:1px solid #29445b;border-radius:15px;background:#07111d;box-shadow:0 28px 80px rgba(0,0,0,.5);overflow:hidden}.requirements-modal-head{padding:22px 24px 18px;border-bottom:1px solid #1b3042;display:flex;justify-content:space-between;gap:20px}.requirements-modal h2{margin:0;color:#edf3f9;font-size:22px;letter-spacing:-.025em}.requirements-modal p{margin:8px 0 0;color:#6c859d;font-size:11px}.requirements-close{width:34px;height:34px;flex:none;border:1px solid #29445b;border-radius:9px;background:#091827;color:#7d96ad;display:grid;place-items:center;cursor:pointer}.requirements-modal form{padding:22px 24px 24px;display:grid;gap:18px}.requirements-modal label{display:grid;gap:8px;color:#b8cadb;font-size:11px;font-weight:650}.requirements-modal label span{font-weight:400;color:#637c93;margin-left:3px}.requirements-modal input,.requirements-modal textarea{width:100%;box-sizing:border-box;border:1px solid #20394e;border-radius:9px;background:#050d16;color:#e0eaf3;outline:0;padding:12px;font:500 12px/1.4 inherit;resize:vertical}.requirements-modal input:focus,.requirements-modal textarea:focus{border-color:#3a6589;box-shadow:0 0 0 3px rgba(61,109,151,.1)}.requirements-modal-actions{display:flex;justify-content:flex-end;gap:9px;padding-top:2px}
@media (max-width:760px){.requirements-page{padding:26px 16px 42px}.requirements-header{align-items:flex-start;flex-direction:column}.requirements-header h1{font-size:36px}.requirements-primary-button{width:auto}.requirements-table-head{display:none}.requirements-row{grid-template-columns:minmax(0,1fr) 72px 20px;column-gap:10px;padding:14px}.requirements-row>div:nth-child(3){display:none}.requirements-used-cell{text-align:right}.requirements-footer-card{flex-direction:column;align-items:flex-start}.requirements-flow{white-space:normal}.requirements-name-cell span{max-width:calc(100vw - 190px)} }
`;
