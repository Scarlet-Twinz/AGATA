import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Member = { id:string; name:string; email:string; joined_at:string };
export default function TeamPage() {
  const [members,setMembers]=useState<Member[]>([]); const [error,setError]=useState("");
  useEffect(()=>{api<Member[]>("/api/workspace/team").then(setMembers).catch(e=>setError(e instanceof Error?e.message:"Unable to load team."));},[]);
  return <main style={{maxWidth:1180,margin:"0 auto",padding:"30px"}}><div style={{fontSize:12,letterSpacing:1.5,opacity:.55}}>WORKSPACE ACCESS</div><h1 style={{margin:"8px 0 6px"}}>Team</h1><p style={{opacity:.65}}>People with access to this AGATA workspace.</p>{error&&<p>{error}</p>}<section style={{marginTop:28,border:"1px solid rgba(255,255,255,.08)",borderRadius:16,overflow:"hidden"}}>{members.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><div style={{width:40,height:40,borderRadius:"50%",display:"grid",placeItems:"center",background:"rgba(255,255,255,.08)",fontWeight:700}}>{m.name?.[0]?.toUpperCase()||"A"}</div><div style={{flex:1}}><strong>{m.name}</strong><div style={{fontSize:13,opacity:.55,marginTop:3}}>{m.email}</div></div><span style={{fontSize:12,opacity:.55}}>Member</span></div>)}{!members.length&&!error&&<div style={{padding:24,opacity:.6}}>No workspace members found.</div>}</section></main>;
}
