import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function BillingPage() {
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<any>("/api/workspace/summary").then(setSummary).catch(e => setError(e instanceof Error ? e.message : "Unable to load billing information.")); }, []);
  return <main style={{maxWidth:1180,margin:"0 auto",padding:"30px"}}><div style={{fontSize:12,letterSpacing:1.5,opacity:.55}}>WORKSPACE</div><h1 style={{margin:"8px 0 6px"}}>Billing &amp; Plan</h1><p style={{opacity:.65}}>Plan and billing controls for this AGATA workspace.</p>{error&&<p>{error}</p>}<section style={{display:"grid",gridTemplateColumns:"minmax(0,1.4fr) minmax(260px,1fr)",gap:16,marginTop:28}}><article style={{padding:24,border:"1px solid rgba(255,255,255,.08)",borderRadius:16}}><div style={{fontSize:12,letterSpacing:1.2,opacity:.5}}>CURRENT BILLING STATE</div><h2 style={{margin:"10px 0"}}>Billing not configured</h2><p style={{opacity:.6,lineHeight:1.6}}>This development workspace has no active subscription or payment method configured. No plan, price, renewal date, or invoice is being invented here.</p></article><article style={{padding:24,border:"1px solid rgba(255,255,255,.08)",borderRadius:16}}><div style={{fontSize:12,letterSpacing:1.2,opacity:.5}}>WORKSPACE SCALE</div><h2 style={{margin:"10px 0"}}>{summary?.company?.name || "AGATA Workspace"}</h2><p style={{opacity:.6}}>{summary ? `${summary.counts.projects} projects · ${summary.counts.contractors} contractors · ${summary.counts.evidence} evidence` : "Loading workspace usage…"}</p></article></section></main>;
}
