import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [preview, setPreview] = useState<{ email:string; role_name:string; company_name:string } | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setError("This invitation link is missing its token."); return; }
    api<{email:string;role_name:string;company_name:string}>(`/api/workspace/invitations/preview?token=${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch((err) => setError(err instanceof Error ? err.message : "This invitation is invalid or has expired."));
  }, [token]);

  async function accept(event: FormEvent) {
    event.preventDefault(); setError(""); setSuccess("");
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const result = await api<{message:string}>("/api/workspace/invitations/accept", { method:"POST", body:JSON.stringify({ token, full_name:fullName.trim(), password }) });
      setSuccess(result.message);
      window.setTimeout(() => navigate(`/login?email=${encodeURIComponent(preview?.email || "")}`, { replace:true }), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to accept this invitation.");
    } finally { setBusy(false); }
  }

  return <section className="auth-page"><div className="auth-card">
    <div className="auth-heading"><p className="section-kicker">Workspace invitation</p><h1>Join {preview?.company_name || "this AGATA workspace"}.</h1><p>{preview ? <>You've been invited as <strong>{preview.role_name}</strong> using <strong>{preview.email}</strong>.</> : "Checking your invitation…"}</p></div>
    {preview && <form className="auth-form" onSubmit={accept}>
      <label>Your name<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} /></label>
      <label>Password<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="auth-success" role="status">{success}</div>}
      <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Joining workspace…" : "Accept invitation"}<span>→</span></button>
    </form>}
    {!preview && error && <div className="auth-error" role="alert">{error}</div>}
    <p className="auth-switch">Already have an AGATA account? <Link to="/login">Sign in</Link></p>
  </div></section>;
}
