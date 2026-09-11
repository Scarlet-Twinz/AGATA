import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function UsagePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => { api<any>("/api/workspace/summary").then(setData).catch((e) => setError(e instanceof Error ? e.message : "Unable to load usage.")); }, []);

  const cards = data ? [
    ["Projects", data.counts.projects], ["Contractors", data.counts.contractors],
    ["Requirements", data.counts.requirements], ["Evidence", data.counts.evidence],
    ["Workspace users", data.counts.users],
  ] : [];

  return <main style={{maxWidth:1180,margin:"0 auto",padding:"30px"}}><div style={{fontSize:12,letterSpacing:1.5,opacity:.55}}>WORKSPACE</div><h1 style={{margin:"8px 0 6px"}}>Usage</h1><p style={{opacity:.65,marginTop:0}}>Live workspace counts from AGATA.</p>{error&&<p>{error}</p>}<section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:14,marginTop:28}}>{cards.map(([label,value])=><article key={label as string} style={{padding:22,border:"1px solid rgba(255,255,255,.08)",borderRadius:16,background:"rgba(255,255,255,.025)"}}><div style={{fontSize:12,opacity:.55}}>{label}</div><strong style={{display:"block",fontSize:30,marginTop:10}}>{value as number}</strong></article>)}</section></main>;
}
