import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Item = {
  project_id: string;
  project_name: string;
  contractor_id: string;
  contractor_name: string;
  contractor_status: string;
  evaluated: boolean;
  score: number | null;
  status: string | null;
  explanation: string | null;
  missing_requirements: string[];
  checked_at: string | null;
};

function Icon({ name, size = 18 }: { name: "search" | "arrow" | "check" | "alert" | "clock"; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "check") return <svg {...c}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "alert") return <svg {...c}><path d="M12 4 3.5 19h17z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  if (name === "clock") return <svg {...c}><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>;
  return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
}

function statusLabel(status: string | null) {
  if (status === "ready") return "Ready";
  if (status === "attention") return "Attention";
  if (status === "not_ready") return "Not ready";
  return "Not evaluated";
}

export default function ReadinessPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
      setItems(await api<Item[]>("/api/readiness"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load readiness.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function evaluate(item: Item) {
    const key = `${item.project_id}:${item.contractor_id}`;
    try {
      setWorking(key); setError("");
      await api(`/api/readiness/projects/${item.project_id}/contractors/${item.contractor_id}`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to evaluate readiness.");
    } finally { setWorking(null); }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !q || `${item.project_name} ${item.contractor_name}`.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || (filter === "evaluated" ? item.evaluated : item.status === filter);
      return matchesQuery && matchesFilter;
    });
  }, [items, query, filter]);

  const counts = useMemo(() => ({
    total: items.length,
    ready: items.filter((i) => i.status === "ready").length,
    attention: items.filter((i) => i.status === "attention").length,
    notReady: items.filter((i) => i.status === "not_ready").length,
    evaluated: items.filter((i) => i.evaluated).length,
  }), [items]);

  return <>
    <style>{styles}</style>
    <section className="readiness-page">
      <header className="readiness-header">
        <div><span className="readiness-eyebrow">WORK · READINESS</span><h1>Readiness</h1><p>Turn contractor evidence into explainable project readiness decisions.</p></div>
      </header>

      {error && <div className="readiness-error" role="alert">{error}</div>}

      <section className="readiness-stats">
        <button className={`readiness-stat ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}><span>Assigned</span><strong>{counts.total}</strong><small>contractor-project pairs</small></button>
        <button className={`readiness-stat ready ${filter === "ready" ? "active" : ""}`} onClick={() => setFilter("ready")}><span>Ready</span><strong>{counts.ready}</strong><small>cleared checks</small></button>
        <button className={`readiness-stat attention ${filter === "attention" ? "active" : ""}`} onClick={() => setFilter("attention")}><span>Attention</span><strong>{counts.attention}</strong><small>need review</small></button>
        <button className={`readiness-stat danger ${filter === "not_ready" ? "active" : ""}`} onClick={() => setFilter("not_ready")}><span>Not ready</span><strong>{counts.notReady}</strong><small>missing or invalid evidence</small></button>
      </section>

      <section className="readiness-toolbar">
        <label className="readiness-search"><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects or contractors" aria-label="Search projects or contractors"/></label>
        <button className={`readiness-filter ${filter === "evaluated" ? "selected" : ""}`} onClick={() => setFilter(filter === "evaluated" ? "all" : "evaluated")}>{counts.evaluated} evaluated</button>
        <span className="readiness-count">{filtered.length} {filtered.length === 1 ? "check" : "checks"}</span>
      </section>

      <section className="readiness-panel">
        <div className="readiness-table-head"><span>Project / Contractor</span><span>Readiness</span><span>Score</span><span>Last checked</span><span/></div>
        {loading ? <div className="readiness-state"><div className="readiness-spinner"/><span>Loading readiness…</span></div> : filtered.length === 0 ? <div className="readiness-empty"><div className="readiness-empty-icon"><Icon name="check" size={22}/></div><strong>{items.length ? "No matching readiness checks" : "No contractor assignments yet"}</strong><span>{items.length ? "Try a different search or filter." : "Assign contractors to projects first. Readiness checks will appear here."}</span></div> : <div>{filtered.map((item) => { const key = `${item.project_id}:${item.contractor_id}`; const status = statusLabel(item.status); return <article className="readiness-row" key={key}>
          <button className="readiness-identity" onClick={() => navigate(`/contractors/${item.contractor_id}`)}><div className="readiness-avatar">{item.contractor_name.slice(0, 1).toUpperCase()}</div><div><strong>{item.project_name}</strong><span>{item.contractor_name} · {item.contractor_status}</span></div></button>
          <div><span className={`readiness-chip ${item.status || "pending"}`}><Icon name={item.status === "ready" ? "check" : item.status === "attention" || item.status === "not_ready" ? "alert" : "clock"} size={12}/>{status}</span>{item.explanation && <p className="readiness-explanation">{item.explanation}</p>}{item.missing_requirements.length > 0 && <p className="readiness-missing">Missing: {item.missing_requirements.join(", ")}</p>}</div>
          <div className="readiness-score">{item.score == null ? "—" : `${item.score}%`}</div>
          <div className="readiness-checked">{item.checked_at ? new Date(item.checked_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Not checked"}</div>
          <button className="readiness-action" disabled={working === key} onClick={() => void evaluate(item)}>{working === key ? "Checking…" : item.evaluated ? "Re-check" : "Evaluate"}<Icon name="arrow" size={14}/></button>
        </article>; })}</div>}
      </section>

      <section className="readiness-footer"><div><span className="readiness-eyebrow">THE AGATA DECISION</span><h2>Evidence in. Decision out.</h2><p>AGATA evaluates the requirements attached to a project against the contractor's valid evidence, then records an explainable readiness result.</p></div><div className="readiness-flow"><span>Evidence</span><Icon name="arrow" size={13}/><span>Requirements</span><Icon name="arrow" size={13}/><span>Readiness</span></div></section>
    </section>
  </>;
}

const styles = `
.readiness-page{max-width:1120px;margin:0 auto;padding:40px 30px 56px;color:#e8eef7}.readiness-header{margin-bottom:25px}.readiness-eyebrow{display:block;font-size:9px;letter-spacing:.19em;font-weight:700;color:#7f9bb8;margin-bottom:8px}.readiness-header h1{margin:0;font-size:44px;line-height:1;font-weight:760;letter-spacing:-.045em}.readiness-header p{margin:12px 0 0;color:#7890a9;font-size:13px}.readiness-error{border:1px solid #6b3941;background:#29171c;color:#e9b5bc;border-radius:10px;padding:11px 13px;margin-bottom:16px;font-size:12px}.readiness-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}.readiness-stat{border:1px solid #1b344a;border-radius:13px;background:#07131f;text-align:left;padding:15px 16px;color:#dce8f3;cursor:pointer}.readiness-stat:hover,.readiness-stat.active{border-color:#376486;background:#091a2a}.readiness-stat span{display:block;font-size:9px;color:#6d87a0;text-transform:uppercase;letter-spacing:.12em}.readiness-stat strong{display:block;font-size:25px;line-height:1;margin:8px 0 5px}.readiness-stat small{color:#58728a;font-size:9px}.readiness-stat.ready strong{color:#78d8a3}.readiness-stat.attention strong{color:#e6c46b}.readiness-stat.danger strong{color:#e57f89}.readiness-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px}.readiness-search{width:min(460px,100%);height:42px;border:1px solid #1d3449;border-radius:10px;background:#07111d;display:flex;align-items:center;gap:10px;padding:0 13px;color:#607b94}.readiness-search:focus-within{border-color:#315d83;box-shadow:0 0 0 3px rgba(55,104,150,.12)}.readiness-search input{border:0;outline:0;background:transparent;color:#dce8f4;width:100%;font:500 12px/1.2 inherit}.readiness-search input::placeholder{color:#526b83}.readiness-filter{border:1px solid #1d3449;border-radius:9px;background:#07131f;color:#7590a8;padding:11px 13px;font:600 10px inherit;cursor:pointer}.readiness-filter.selected{border-color:#3b6486;color:#c5d8e8}.readiness-count{margin-left:auto;color:#637c94;font-size:11px}.readiness-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;overflow:hidden}.readiness-table-head,.readiness-row{display:grid;grid-template-columns:minmax(250px,1.25fr) minmax(260px,1.3fr) 80px 105px 90px;align-items:center;column-gap:18px}.readiness-table-head{min-height:46px;padding:0 18px;border-bottom:1px solid #192c3e;color:#5f7890;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}.readiness-row{min-height:96px;padding:13px 18px;border-bottom:1px solid #142638}.readiness-row:last-child{border-bottom:0}.readiness-row:hover{background:#08131f}.readiness-identity{border:0;background:transparent;color:inherit;text-align:left;display:flex;align-items:center;gap:11px;min-width:0;cursor:pointer;padding:0}.readiness-avatar{width:34px;height:34px;flex:none;border:1px solid #29465e;border-radius:9px;background:#091a28;display:grid;place-items:center;color:#9cc0dd;font-size:12px;font-weight:700}.readiness-identity strong{display:block;color:#dfe8f1;font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.readiness-identity span{display:block;color:#637d95;font-size:10px;margin-top:5px}.readiness-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:650;border:1px solid #2b4154;background:#0b1722;color:#8da6ba}.readiness-chip.ready{border-color:#28583f;background:#0a2419;color:#6fd59d}.readiness-chip.attention{border-color:#665529;background:#211d0d;color:#e0c56b}.readiness-chip.not_ready{border-color:#653a40;background:#261419;color:#e28a94}.readiness-explanation,.readiness-missing{margin:6px 0 0;color:#627b93;font-size:9px;line-height:1.35}.readiness-missing{color:#d18a92}.readiness-score{font-size:13px;font-weight:700;color:#dce7f1}.readiness-checked{font-size:10px;color:#647e96}.readiness-action{border:1px solid #29465d;border-radius:8px;background:#0a1927;color:#9bb8d0;padding:8px 9px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font:600 9px inherit;cursor:pointer}.readiness-action:hover{border-color:#3b6689;color:#d5e4ef}.readiness-action:disabled{opacity:.55;cursor:wait}.readiness-state{min-height:320px;display:flex;align-items:center;justify-content:center;gap:10px;color:#69829a;font-size:12px}.readiness-spinner{width:16px;height:16px;border:2px solid #20394f;border-top-color:#78a9d1;border-radius:50%;animation:readiness-spin .8s linear infinite}@keyframes readiness-spin{to{transform:rotate(360deg)}}.readiness-empty{min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px}.readiness-empty-icon{width:48px;height:48px;border:1px solid #28445c;border-radius:12px;background:#081827;display:grid;place-items:center;color:#79a6ce;margin-bottom:13px}.readiness-empty strong{font-size:13px;color:#dce6ef}.readiness-empty span{max-width:420px;margin-top:7px;color:#667f97;font-size:11px}.readiness-footer{margin-top:18px;border:1px solid #1b3044;border-radius:14px;background:#07111c;padding:20px 22px;display:flex;align-items:center;justify-content:space-between;gap:28px}.readiness-footer h2{margin:0;color:#dce6f0;font-size:17px;letter-spacing:-.02em}.readiness-footer p{margin:7px 0 0;color:#667f97;font-size:11px;max-width:650px}.readiness-flow{display:flex;align-items:center;gap:9px;white-space:nowrap;color:#86a4bd;font-size:10px}.readiness-flow svg{color:#4c6982}@media(max-width:900px){.readiness-stats{grid-template-columns:repeat(2,1fr)}.readiness-table-head{display:none}.readiness-row{grid-template-columns:minmax(0,1fr) 100px 80px;column-gap:10px}.readiness-row>div:nth-child(2){grid-column:1/-1;grid-row:2}.readiness-row>div:nth-child(3){grid-column:2;grid-row:1}.readiness-row>div:nth-child(4){display:none}.readiness-action{grid-column:3;grid-row:1}.readiness-footer{flex-direction:column;align-items:flex-start}.readiness-flow{white-space:normal}}@media(max-width:620px){.readiness-page{padding:26px 16px 42px}.readiness-header h1{font-size:36px}.readiness-toolbar{flex-wrap:wrap}.readiness-search{width:100%}.readiness-count{margin-left:auto}.readiness-row{grid-template-columns:minmax(0,1fr) 82px;min-height:110px;padding:13px}.readiness-row>div:nth-child(3){grid-column:2}.readiness-action{grid-column:2;grid-row:2}.readiness-stats{gap:8px}.readiness-stat{padding:13px}.readiness-stat strong{font-size:22px}}
`;
