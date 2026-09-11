import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function SettingsPage(){
 const [data,setData]=useState<any>(null); const [error,setError]=useState("");
 useEffect(()=>{api<any>("/api/workspace/profile").then(setData).catch(e=>setError(e instanceof Error?e.message:"Unable to load settings."));},[]);
 return <main style={{maxWidth:980,margin:"0 auto",padding:"30px"}}><div style={{fontSize:12,letterSpacing:1.5,opacity:.55}}>WORKSPACE</div><h1 style={{margin:"8px 0 6px"}}>Settings</h1><p style={{opacity:.65}}>Workspace and account information.</p>{error&&<p>{error}</p>}<section style={{display:"grid",gap:16,marginTop:28}}>{data&&<><article style={{padding:22,border:"1px solid rgba(255,255,255,.08)",borderRadius:16}}><div style={{fontSize:12,opacity:.55}}>COMPANY</div><h2 style={{margin:"8px 0"}}>{data.company?.name||"—"}</h2><div style={{fontSize:13,opacity:.55}}>Workspace ID · {data.company?.id||"—"}</div></article><article style={{padding:22,border:"1px solid rgba(255,255,255,.08)",borderRadius:16}}><div style={{fontSize:12,opacity:.55}}>YOUR ACCOUNT</div><h2 style={{margin:"8px 0"}}>{data.user?.name||"—"}</h2><div style={{fontSize:13,opacity:.55}}>{data.user?.email||"—"}</div></article></>}</section></main>;
}
