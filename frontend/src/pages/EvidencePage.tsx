import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

type Contractor = { id: string; name: string; email: string | null; phone: string | null; status: string };
type Requirement = { id: string; name: string; description: string | null };
type Document = { id: string; contractor_id: string | null; name: string; document_type: string; expires_at: string | null; storage_key: string | null; status: string; created_at: string };
type Match = { id: string; document_id: string; requirement_id: string; created_at: string };
type DocumentDetail = { document: Document; contractor_id: string | null; contractor_name: string | null; matches: Match[] };
type EvidenceState = "valid" | "expiring" | "expired" | "unmapped" | "inactive";

function Icon({ name, size = 18 }: { name: "search" | "plus" | "file" | "arrow" | "close" | "check" | "link" | "alert" | "trash"; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "search") return <svg {...c}><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>;
  if (name === "plus") return <svg {...c}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
  if (name === "file") return <svg {...c}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/></svg>;
  if (name === "arrow") return <svg {...c}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
  if (name === "check") return <svg {...c}><path d="m5 12 4 4L19 6"/></svg>;
  if (name === "link") return <svg {...c}><path d="M10 13a5 5 0 0 0 7.5.4l1.5-1.5a5 5 0 0 0-7.1-7.1l-.9.9"/><path d="M14 11a5 5 0 0 0-7.5-.4L5 12.1a5 5 0 0 0 7.1 7.1l.9-.9"/></svg>;
  if (name === "alert") return <svg {...c}><path d="m12 4 9 16H3L12 4Z"/><path d="M12 9v4"/><path d="M12 16h.01"/></svg>;
  if (name === "trash") return <svg {...c}><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>;
  return <svg {...c}><path d="m7 7 10 10"/><path d="m17 7-10 10"/></svg>;
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return Math.ceil((time - Date.now()) / 86400000);
}

function evidenceState(document: Document, mapped: boolean): EvidenceState {
  if (document.status !== "active") return "inactive";
  const days = daysUntil(document.expires_at);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days <= 30) return "expiring";
  if (!mapped) return "unmapped";
  return "valid";
}

function stateLabel(value: EvidenceState) {
  if (value === "valid") return "Valid";
  if (value === "expiring") return "Expiring soon";
  if (value === "expired") return "Expired";
  if (value === "unmapped") return "Unmapped";
  return "Inactive";
}

function stateClass(value: EvidenceState) { return value.replace(" ", "-"); }
function dateLabel(value: string | null) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}
function toIsoDate(value: string) {
  if (!value) return null;
  return new Date(`${value}T23:59:59`).toISOString();
}

export default function EvidencePage() {
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [details, setDetails] = useState<Record<string, DocumentDetail>>({});
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function load() {
    try {
      setLoading(true); setError("");
      const [documentList, contractorList, requirementList] = await Promise.all([
        api<Document[]>("/api/documents"),
        api<Contractor[]>("/api/contractors"),
        api<Requirement[]>("/api/requirements"),
      ]);
      setDocuments(documentList); setContractors(contractorList); setRequirements(requirementList);
      const entries = await Promise.all(documentList.map(async (document) => {
        try { return [document.id, await api<DocumentDetail>(`/api/documents/${document.id}/detail`)] as const; }
        catch { return null; }
      }));
      setDetails(Object.fromEntries(entries.filter((entry): entry is readonly [string, DocumentDetail] => entry !== null)));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load evidence."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const contractorNames = useMemo(() => Object.fromEntries(contractors.map((item) => [item.id, item.name])), [contractors]);
  const requirementNames = useMemo(() => Object.fromEntries(requirements.map((item) => [item.id, item.name])), [requirements]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return documents.filter((document) => {
      const detail = details[document.id];
      const mapped = Boolean(detail?.matches.length);
      const state = evidenceState(document, mapped);
      const matchesQuery = !value || `${document.name} ${document.document_type} ${contractorNames[document.contractor_id || ""] || ""}`.toLowerCase().includes(value);
      const matchesFilter = filter === "all" || (filter === "unmapped" ? !mapped && document.status === "active" : state === filter);
      return matchesQuery && matchesFilter;
    });
  }, [documents, details, query, filter, contractorNames]);

  const counts = useMemo(() => documents.reduce((acc, document) => {
    const mapped = Boolean(details[document.id]?.matches.length);
    const state = evidenceState(document, mapped);
    acc[state] += 1;
    return acc;
  }, { valid: 0, expiring: 0, expired: 0, unmapped: 0, inactive: 0 } as Record<EvidenceState, number>), [documents, details]);

  async function createEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !documentType.trim() || !contractorId) return;
    try {
      setSaving(true); setError("");
      await api("/api/documents", { method: "POST", body: JSON.stringify({ contractor_id: contractorId, name: name.trim(), document_type: documentType.trim(), expires_at: toIsoDate(expiresAt) }) });
      setName(""); setDocumentType(""); setContractorId(""); setExpiresAt(""); setShowCreate(false); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create evidence."); }
    finally { setSaving(false); }
  }

  async function updateSelected(patch: Partial<Document>) {
    if (!selectedId) return;
    try {
      setBusyId(selectedId); setError("");
      await api(`/api/documents/${selectedId}`, { method: "PUT", body: JSON.stringify(patch) });
      await load();
      setSelectedId(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to update evidence."); }
    finally { setBusyId(""); }
  }

  async function deleteSelected() {
    if (!selectedId) return;
    const target = documents.find((item) => item.id === selectedId);
    if (!target) return;
    if (!window.confirm(`Delete “${target.name}”? This cannot be undone.`)) return;
    try {
      setBusyId(selectedId); setError("");
      await api(`/api/documents/${selectedId}`, { method: "DELETE" });
      setSelectedId(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete evidence."); }
    finally { setBusyId(""); }
  }

  async function mapRequirement(requirementId: string) {
    if (!selectedId) return;
    try {
      setBusyId(requirementId); setError("");
      await api(`/api/documents/${selectedId}/requirements/${requirementId}`, { method: "POST" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to map evidence."); }
    finally { setBusyId(""); }
  }

  async function unmapRequirement(requirementId: string) {
    if (!selectedId) return;
    try {
      setBusyId(requirementId); setError("");
      await api(`/api/documents/${selectedId}/requirements/${requirementId}`, { method: "DELETE" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove evidence mapping."); }
    finally { setBusyId(""); }
  }

  const selected = selectedId ? details[selectedId] : null;
  const selectedDocument = selected?.document;
  const mappedRequirementIds = new Set(selected?.matches.map((match) => match.requirement_id) ?? []);

  return <>
    <style>{styles}</style>
    <section className="evidence-page">
      <header className="evidence-header"><div><span className="evidence-eyebrow">WORK · EVIDENCE</span><h1>Evidence</h1><p>Store the evidence that supports contractor compliance and connect it to the requirements it satisfies.</p></div><button className="evidence-primary" type="button" onClick={() => setShowCreate(true)}><Icon name="plus" size={15}/> Add evidence</button></header>
      {error && <div className="evidence-error" role="alert"><Icon name="alert" size={15}/><span>{error}</span></div>}

      <section className="evidence-stats">
        <button className={`evidence-stat ${filter === "all" ? "selected" : ""}`} type="button" onClick={() => setFilter("all")}><span>Total evidence</span><strong>{documents.length}</strong></button>
        <button className={`evidence-stat ${filter === "valid" ? "selected" : ""}`} type="button" onClick={() => setFilter("valid")}><span>Valid</span><strong>{counts.valid}</strong></button>
        <button className={`evidence-stat ${filter === "expiring" ? "selected" : ""}`} type="button" onClick={() => setFilter("expiring")}><span>Expiring soon</span><strong>{counts.expiring}</strong></button>
        <button className={`evidence-stat ${filter === "expired" ? "selected" : ""}`} type="button" onClick={() => setFilter("expired")}><span>Expired</span><strong>{counts.expired}</strong></button>
        <button className={`evidence-stat ${filter === "unmapped" ? "selected" : ""}`} type="button" onClick={() => setFilter("unmapped")}><span>Unmapped</span><strong>{counts.unmapped}</strong></button>
      </section>

      <section className="evidence-toolbar"><label className="evidence-search"><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search evidence, type, or contractor" aria-label="Search evidence"/></label><span className="evidence-count">{filtered.length} {filtered.length === 1 ? "record" : "records"}</span></section>

      <section className="evidence-panel">
        <div className="evidence-head"><span>Evidence</span><span>Contractor</span><span>Expiry</span><span>Mapping</span><span>State</span><span aria-hidden="true"/></div>
        {loading ? <div className="evidence-state"><div className="evidence-spinner"/><span>Loading evidence workspace…</span></div> : filtered.length === 0 ? <div className="evidence-empty"><div className="evidence-empty-icon"><Icon name="file" size={22}/></div><strong>{documents.length ? "No matching evidence" : "No evidence yet"}</strong><span>{documents.length ? "Try a different search or filter." : "Add evidence to a contractor before mapping it to project requirements."}</span>{!documents.length && <button className="evidence-secondary" type="button" onClick={() => setShowCreate(true)}>Add first evidence</button>}</div> : <div className="evidence-list">{filtered.map((document) => { const detail = details[document.id]; const mapped = Boolean(detail?.matches.length); const state = evidenceState(document, mapped); return <button className="evidence-row" key={document.id} type="button" onClick={() => setSelectedId(document.id)}><div className="evidence-main"><div className="evidence-icon"><Icon name="file" size={15}/></div><div><strong>{document.name}</strong><span>{document.document_type}</span></div></div><div className="evidence-contractor">{contractorNames[document.contractor_id || ""] || "Unassigned"}</div><div className="evidence-expiry">{dateLabel(document.expires_at)}</div><div className="evidence-mapping">{mapped ? <><Icon name="link" size={13}/><span>{detail?.matches.length} {detail?.matches.length === 1 ? "requirement" : "requirements"}</span></> : <span>Not mapped</span>}</div><div><span className={`evidence-state-chip ${stateClass(state)}`}>{stateLabel(state)}</span></div><div className="evidence-arrow"><Icon name="arrow" size={14}/></div></button>; })}</div>}
      </section>

      <section className="evidence-footer"><div><span className="evidence-eyebrow">THE AGATA EVIDENCE MODEL</span><h2>Evidence is only useful when it can explain readiness.</h2><p>Every evidence record belongs to a contractor. Map it to the requirements it supports, keep expiry information current, and AGATA can use those records in readiness decisions.</p></div><div className="evidence-flow"><span>Contractor</span><Icon name="arrow" size={13}/><span>Evidence</span><Icon name="arrow" size={13}/><span>Requirement</span><Icon name="arrow" size={13}/><span>Readiness</span></div></section>
    </section>

    {showCreate && <div className="evidence-modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setShowCreate(false); }}><section className="evidence-modal" role="dialog" aria-modal="true" aria-labelledby="create-evidence-title"><div className="evidence-modal-head"><div><span className="evidence-eyebrow">NEW EVIDENCE</span><h2 id="create-evidence-title">Add an evidence record</h2><p>Attach the record to its contractor first. You can map requirements after it is created.</p></div><button className="evidence-close" type="button" onClick={() => setShowCreate(false)} aria-label="Close"><Icon name="close" size={17}/></button></div><form onSubmit={createEvidence}><label>Contractor<select value={contractorId} onChange={(e) => setContractorId(e.target.value)} required><option value="">Select contractor</option>{contractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}</select></label><label>Evidence name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insurance Certificate" required/></label><label>Evidence type<input value={documentType} onChange={(e) => setDocumentType(e.target.value)} placeholder="e.g. Insurance Certificate" required/></label><label>Expiry date <span>Optional</span><input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}/></label><div className="evidence-modal-actions"><button className="evidence-secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="evidence-primary" type="submit" disabled={saving || !name.trim() || !documentType.trim() || !contractorId}>{saving ? "Creating…" : "Create evidence"}</button></div></form></section></div>}

    {selectedDocument && <div className="evidence-modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) setSelectedId(null); }}><section className="evidence-detail-modal" role="dialog" aria-modal="true" aria-labelledby="evidence-detail-title"><div className="evidence-modal-head"><div><span className="evidence-eyebrow">EVIDENCE RECORD</span><h2 id="evidence-detail-title">{selectedDocument.name}</h2><p>{selectedDocument.document_type} · {selected?.contractor_name || "Unassigned"}</p></div><button className="evidence-close" type="button" onClick={() => setSelectedId(null)} aria-label="Close"><Icon name="close" size={17}/></button></div><div className="evidence-detail-body"><div className="evidence-detail-grid"><div><span>Contractor</span><strong>{selected?.contractor_name || "Unassigned"}</strong></div><div><span>Expiry</span><strong>{dateLabel(selectedDocument.expires_at)}</strong></div><div><span>Status</span><strong>{selectedDocument.status === "active" ? "Active" : selectedDocument.status}</strong></div><div><span>Created</span><strong>{dateLabel(selectedDocument.created_at)}</strong></div></div><div className="evidence-detail-section"><div className="evidence-detail-section-head"><div><span className="evidence-eyebrow">MAPPING</span><h3>Requirements this evidence satisfies</h3></div></div>{selected.matches.length ? <div className="mapped-list">{selected.matches.map((match) => <div className="mapped-item" key={match.id}><div><Icon name="check" size={14}/><span>{requirementNames[match.requirement_id] || "Requirement"}</span></div><button type="button" disabled={busyId === match.requirement_id} onClick={() => void unmapRequirement(match.requirement_id)}>Remove</button></div>)}</div> : <div className="mapping-empty"><Icon name="link" size={16}/><span>This evidence is not mapped to a requirement yet.</span></div>}</div><div className="evidence-detail-section"><span className="evidence-eyebrow">AVAILABLE REQUIREMENTS</span><div className="available-list">{requirements.filter((requirement) => !mappedRequirementIds.has(requirement.id)).map((requirement) => <button className="available-item" key={requirement.id} type="button" disabled={busyId === requirement.id} onClick={() => void mapRequirement(requirement.id)}><span>{requirement.name}</span><Icon name="plus" size={14}/></button>)}</div>{requirements.length === mappedRequirementIds.size && <span className="all-mapped">All workspace requirements are already mapped to this evidence.</span>}</div><div className="evidence-detail-actions"><button className="evidence-secondary" type="button" disabled={busyId === selectedDocument.id} onClick={() => void updateSelected({ status: selectedDocument.status === "active" ? "inactive" : "active" })}>{selectedDocument.status === "active" ? "Mark inactive" : "Reactivate"}</button><button className="evidence-danger" type="button" disabled={busyId === selectedDocument.id} onClick={() => void deleteSelected()}><Icon name="trash" size={14}/> Delete evidence</button></div></div></section></div>}
  </>;
}

const styles = `
.evidence-page{max-width:1180px;margin:0 auto;padding:40px 30px 60px;color:#e8eef7}.evidence-header{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:25px}.evidence-eyebrow{display:block;font-size:9px;letter-spacing:.19em;font-weight:700;color:#7f9bb8;margin-bottom:8px}.evidence-header h1{margin:0;font-size:44px;line-height:1;font-weight:760;letter-spacing:-.045em}.evidence-header p{margin:12px 0 0;color:#7890a9;font-size:13px;max-width:680px}.evidence-primary,.evidence-secondary,.evidence-danger{border:1px solid #29455e;border-radius:10px;background:#0b1d2e;color:#dce9f7;font:600 12px/1 inherit;padding:12px 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:.18s ease}.evidence-primary:hover{border-color:#3c6b91;background:#10283d}.evidence-primary:disabled,.evidence-secondary:disabled,.evidence-danger:disabled{opacity:.55;cursor:not-allowed}.evidence-secondary{background:transparent;color:#a9bdd0}.evidence-secondary:hover{border-color:#3c6b91;background:#0a1725}.evidence-danger{border-color:#63363d;background:#27151a;color:#e39ba5}.evidence-error{display:flex;align-items:center;gap:8px;border:1px solid #6b3941;background:#29171c;color:#e9b5bc;border-radius:10px;padding:11px 13px;margin-bottom:15px;font-size:12px}.evidence-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:13px}.evidence-stat{min-height:82px;text-align:left;border:1px solid #182d41;border-radius:12px;background:#07111b;padding:15px;color:inherit;cursor:pointer}.evidence-stat:hover,.evidence-stat.selected{border-color:#315a7c;background:#0a1825}.evidence-stat span{display:block;color:#627a92;font-size:9px}.evidence-stat strong{display:block;margin-top:8px;font-size:24px;letter-spacing:-.04em}.evidence-toolbar{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:12px}.evidence-search{width:min(500px,100%);height:42px;display:flex;align-items:center;gap:10px;padding:0 13px;border:1px solid #1d3449;border-radius:10px;background:#07111d;color:#607b94}.evidence-search:focus-within{border-color:#315d83;box-shadow:0 0 0 3px rgba(55,104,150,.12)}.evidence-search input,.evidence-modal input,.evidence-modal select{border:0;outline:0;background:transparent;color:#dce8f4;width:100%;font:500 12px/1.2 inherit}.evidence-search input::placeholder{color:#526b83}.evidence-count{font-size:11px;color:#637c94}.evidence-panel{border:1px solid #1b3044;border-radius:14px;background:#050b13;overflow:hidden}.evidence-head,.evidence-row{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(130px,1fr) 120px 130px 100px 25px;align-items:center;column-gap:15px}.evidence-head{min-height:46px;padding:0 18px;border-bottom:1px solid #192c3e;color:#5f7890;font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}.evidence-row{width:100%;box-sizing:border-box;min-height:79px;padding:12px 18px;border:0;border-bottom:1px solid #142638;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.evidence-row:last-child{border-bottom:0}.evidence-row:hover{background:#08131f}.evidence-main{display:flex;align-items:center;gap:10px;min-width:0}.evidence-icon{width:33px;height:33px;display:grid;place-items:center;flex:0 0 33px;border:1px solid #28445c;border-radius:9px;background:#0c1824;color:#79b5e3}.evidence-main>div:last-child{min-width:0}.evidence-main strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#dfe8f1;font-size:11px}.evidence-main span{display:block;margin-top:4px;color:#617a92;font-size:8px}.evidence-contractor,.evidence-expiry{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#8ca2b7;font-size:9px}.evidence-mapping{display:flex;align-items:center;gap:6px;color:#6f91ad;font-size:8px}.evidence-state-chip{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:700}.evidence-state-chip.valid{border:1px solid rgba(113,214,163,.18);background:rgba(48,129,91,.1);color:#71d6a3}.evidence-state-chip.expiring{border:1px solid rgba(224,180,96,.18);background:rgba(126,89,28,.1);color:#d9b16a}.evidence-state-chip.expired{border:1px solid rgba(232,120,120,.17);background:rgba(116,35,35,.1);color:#df8989}.evidence-state-chip.unmapped{border:1px solid rgba(111,174,219,.2);background:rgba(50,104,145,.1);color:#8abfe6}.evidence-state-chip.inactive{border:1px solid #273746;background:#101821;color:#72869a}.evidence-arrow{display:grid;place-items:center;color:#47637b}.evidence-state,.evidence-empty{min-height:300px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;color:#61758a;font-size:10px}.evidence-empty-icon{width:48px;height:48px;display:grid;place-items:center;margin-bottom:6px;border:1px solid #23415b;border-radius:12px;background:#0d1b29;color:#79b8ef}.evidence-empty strong{color:#dce7f0;font-size:12px}.evidence-empty span{max-width:430px;color:#5d7185;font-size:9px;line-height:1.6;margin-bottom:7px}.evidence-spinner{width:25px;height:25px;border:2px solid #1c3449;border-top-color:#76b9ef;border-radius:50%;animation:evidence-spin .8s linear infinite}@keyframes evidence-spin{to{transform:rotate(360deg)}}.evidence-footer{display:flex;align-items:center;justify-content:space-between;gap:35px;margin-top:14px;padding:23px;border:1px solid #172b3e;border-radius:13px;background:#08111b}.evidence-footer h2{margin:0 0 7px;font-size:16px;letter-spacing:-.025em}.evidence-footer p{max-width:650px;margin:0;color:#60758a;font-size:9px;line-height:1.7}.evidence-flow{display:flex;align-items:center;gap:9px;color:#7592aa;font-size:8px;white-space:nowrap}.evidence-flow svg{color:#405c73}.evidence-modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:24px;background:rgba(2,6,10,.74);backdrop-filter:blur(8px)}.evidence-modal,.evidence-detail-modal{width:min(540px,100%);max-height:min(720px,90vh);overflow:auto;border:1px solid #24384b;border-radius:15px;background:#0a1119;box-shadow:0 35px 100px rgba(0,0,0,.48)}.evidence-detail-modal{width:min(680px,100%)}.evidence-modal-head{display:flex;justify-content:space-between;gap:18px;padding:22px;border-bottom:1px solid #172532}.evidence-modal-head h2{margin:7px 0 5px;font-size:20px;letter-spacing:-.025em}.evidence-modal-head p{margin:0;color:#63768a;font-size:9px;line-height:1.6}.evidence-close{width:31px;height:31px;display:grid;place-items:center;flex:0 0 31px;border:1px solid #1d3041;border-radius:8px;background:#0c141d;color:#6b8094;cursor:pointer}.evidence-modal form{display:grid;gap:15px;padding:21px}.evidence-modal label{display:grid;gap:7px;color:#a6b9cb;font-size:9px;font-weight:700}.evidence-modal label span{color:#5f7890;font-weight:500}.evidence-modal input,.evidence-modal select{height:41px;box-sizing:border-box;border:1px solid #1d3449;border-radius:9px;background:#07111b;padding:0 11px;color:#dce8f4}.evidence-modal select option{background:#0a1119}.evidence-modal input:focus,.evidence-modal select:focus{border-color:#315d83}.evidence-modal-actions,.evidence-detail-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:5px}.evidence-detail-body{padding:21px}.evidence-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.evidence-detail-grid>div{min-height:68px;padding:12px;border:1px solid #172b3e;border-radius:10px;background:#07111a}.evidence-detail-grid span{display:block;color:#5f7890;font-size:8px}.evidence-detail-grid strong{display:block;margin-top:7px;color:#dce8f2;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.evidence-detail-section{margin-top:20px}.evidence-detail-section-head{margin-bottom:11px}.evidence-detail-section h3{margin:6px 0 0;font-size:13px}.mapped-list,.available-list{display:grid;gap:6px}.mapped-item,.available-item{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:42px;padding:0 11px;border:1px solid #172b3e;border-radius:9px;background:#07111a;color:#c7d6e2}.mapped-item>div{display:flex;align-items:center;gap:8px;font-size:9px}.mapped-item svg{color:#69ca9b}.mapped-item button{border:0;background:transparent;color:#718ba1;font-size:8px;cursor:pointer}.mapped-item button:hover{color:#c0d6e7}.available-item{width:100%;text-align:left;font:inherit;cursor:pointer}.available-item:hover{border-color:#2d4e69;background:#0a1722}.available-item svg{color:#75a9d0}.available-item:disabled{opacity:.55;cursor:wait}.mapping-empty{display:flex;align-items:center;gap:8px;padding:14px;border:1px dashed #203547;border-radius:9px;color:#60758a;font-size:9px}.mapping-empty svg{color:#638aa8}.all-mapped{display:block;margin-top:8px;color:#566d82;font-size:8px}.evidence-detail-actions{justify-content:space-between;margin-top:25px;padding-top:17px;border-top:1px solid #172b3e}.evidence-detail-actions .evidence-secondary{margin-right:auto}
@media(max-width:900px){.evidence-page{padding:30px 18px 50px}.evidence-stats{grid-template-columns:repeat(3,1fr)}.evidence-head,.evidence-row{grid-template-columns:minmax(0,1.5fr) minmax(120px,1fr) 100px 110px 90px 20px}.evidence-footer{align-items:flex-start;flex-direction:column}.evidence-flow{white-space:normal}.evidence-detail-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.evidence-header{align-items:flex-start;flex-direction:column}.evidence-primary{width:100%}.evidence-stats{grid-template-columns:repeat(2,1fr)}.evidence-head{display:none}.evidence-row{grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:13px 14px}.evidence-row>.evidence-contractor,.evidence-row>.evidence-expiry,.evidence-row>.evidence-mapping{display:none}.evidence-row>div:nth-child(5){justify-self:end}.evidence-arrow{grid-column:2;grid-row:1}.evidence-detail-grid{grid-template-columns:1fr}.evidence-detail-actions{align-items:stretch;flex-direction:column}.evidence-detail-actions .evidence-secondary{margin-right:0}.evidence-modal-backdrop{padding:12px}.evidence-footer{padding:18px}}
`;
