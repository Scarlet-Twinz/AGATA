import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

type Task = {
  id: string;
  project_id: string;
  contractor_id: string;
  requirement_id: string | null;
  assigned_to_user_id: string | null;
  project_name: string;
  contractor_name: string;
  requirement_name: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
};

function label(value: string) {
  return value.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function dateLabel(value: string | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function RemediationPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      setTasks(await api<Task[]>(`/api/remediation?status=${status}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load remediation tasks.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [status]);

  async function updateTask(taskId: string, nextStatus: string) {
    try {
      setBusyId(taskId);
      setError("");
      await api(`/api/remediation/${taskId}`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update remediation task.");
    } finally {
      setBusyId("");
    }
  }

  return <>
    <style>{styles}</style>
    <section className="remediation-page">
      <header className="remediation-header">
        <div>
          <span className="remediation-eyebrow">OPERATIONS · REMEDIATION</span>
          <h1>Remediation</h1>
          <p>Turn readiness gaps into tracked actions. Tasks are generated from real readiness evaluations and remain tied to the affected contractor and requirement.</p>
        </div>
        <Link to="/readiness" className="remediation-secondary">Open readiness</Link>
      </header>

      <div className="remediation-toolbar">
        <div className="remediation-tabs">
          {["open", "in_progress", "completed", "cancelled", "all"].map((item) => <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{label(item)}</button>)}
        </div>
        <span className="remediation-count">{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
      </div>

      {error && <div className="remediation-error" role="alert">{error}</div>}
      {loading ? <div className="remediation-state">Loading operational tasks…</div> : tasks.length === 0 ? <div className="remediation-empty"><strong>No {status === "all" ? "remediation" : label(status).toLowerCase()} tasks</strong><span>Run a readiness evaluation when a contractor has a gap; AGATA will create the corresponding remediation action automatically.</span></div> : <div className="remediation-list">
        {tasks.map((task) => <article className="remediation-card" key={task.id}>
          <div className="remediation-card-top"><div><span className={`priority ${task.priority}`}>{label(task.priority)}</span><h2>{task.title}</h2></div><span className={`task-status ${task.status}`}>{label(task.status)}</span></div>
          <p>{task.description}</p>
          <div className="remediation-meta"><span><b>Project</b>{task.project_name}</span><span><b>Contractor</b>{task.contractor_name}</span><span><b>Requirement</b>{task.requirement_name || "Readiness gap"}</span><span><b>Due</b>{dateLabel(task.due_at)}</span></div>
          <div className="remediation-actions">
            <Link to={`/projects/${task.project_id}/contractors/${task.contractor_id}`} className="task-link">Review readiness →</Link>
            {task.status === "open" && <button disabled={busyId === task.id} onClick={() => void updateTask(task.id, "in_progress")}>{busyId === task.id ? "Updating…" : "Start task"}</button>}
            {task.status === "in_progress" && <button disabled={busyId === task.id} onClick={() => void updateTask(task.id, "completed")}>{busyId === task.id ? "Updating…" : "Mark complete"}</button>}
          </div>
        </article>)}
      </div>}
    </section>
  </>;
}

const styles = `
.remediation-page{min-height:100%;padding:34px 38px 54px;background:#07111d;color:#edf4fb;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.remediation-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:28px}.remediation-header h1{margin:5px 0 8px;font-size:32px;letter-spacing:-.03em}.remediation-header p{max-width:760px;margin:0;color:#8ea2b8;line-height:1.65}.remediation-eyebrow{font-size:11px;letter-spacing:.14em;color:#66809c;font-weight:700}.remediation-secondary{border:1px solid #243b52;border-radius:10px;padding:10px 14px;color:#dce8f4;text-decoration:none;background:#0b1928;white-space:nowrap}.remediation-toolbar{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #182d42;margin-bottom:18px}.remediation-tabs{display:flex;gap:4px;overflow:auto}.remediation-tabs button{border:0;background:transparent;color:#71879d;padding:11px 12px;cursor:pointer;border-bottom:2px solid transparent}.remediation-tabs button.active{color:#eaf3fb;border-bottom-color:#5d91c7}.remediation-count{color:#70879e;font-size:13px}.remediation-error{padding:12px 14px;border:1px solid #633b3b;background:#211517;color:#f1bcbc;border-radius:10px;margin-bottom:16px}.remediation-state,.remediation-empty{padding:52px 20px;text-align:center;border:1px dashed #20384e;border-radius:14px;color:#7890a7;background:#091725}.remediation-empty{display:flex;flex-direction:column;gap:8px}.remediation-empty strong{color:#e3edf6}.remediation-list{display:grid;gap:12px}.remediation-card{border:1px solid #1a3147;background:#091725;border-radius:14px;padding:18px 20px}.remediation-card-top{display:flex;justify-content:space-between;gap:16px}.remediation-card h2{font-size:16px;margin:8px 0 0;letter-spacing:-.01em}.remediation-card p{color:#8fa4b8;line-height:1.55;margin:12px 0 16px}.priority,.task-status{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.priority{background:#152638;color:#9cb4cb}.priority.critical{background:#321b20;color:#f1a7ad}.priority.high{background:#2b2617;color:#e4c87c}.priority.medium{background:#17283a;color:#a8bfd5}.task-status{background:#152536;color:#91a9bf}.task-status.in_progress{background:#20223a;color:#b8b8ee}.task-status.completed{background:#173025;color:#91d1ad}.task-status.cancelled{background:#25282c;color:#9da5ad}.remediation-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:13px 0;border-top:1px solid #142a3e;border-bottom:1px solid #142a3e}.remediation-meta span{display:flex;flex-direction:column;gap:4px;color:#c4d1dd;font-size:12px;min-width:0}.remediation-meta b{font-size:10px;color:#607990;text-transform:uppercase;letter-spacing:.08em}.remediation-actions{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:14px}.remediation-actions button,.task-link{border:1px solid #29425a;border-radius:9px;padding:8px 11px;background:#0d1d2d;color:#dbe8f3;text-decoration:none;font-size:12px;cursor:pointer}.remediation-actions button:hover,.task-link:hover{background:#11263a}.remediation-actions button:disabled{opacity:.55;cursor:wait}@media(max-width:800px){.remediation-page{padding:24px 18px}.remediation-header{flex-direction:column}.remediation-meta{grid-template-columns:repeat(2,minmax(0,1fr))}.remediation-actions{justify-content:flex-start;flex-wrap:wrap}}
`;
