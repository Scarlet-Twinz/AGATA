import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

export function AcceptInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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

  async function acceptNewUser(event: FormEvent) {
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

  async function acceptExistingUser() {
    setError(""); setSuccess(""); setBusy(true);
    try {
      const result = await api<{message:string}>(`/api/workspace/invitations/accept-authenticated?token=${encodeURIComponent(token)}`, { method:"POST" });
      setSuccess(result.message);
      window.setTimeout(() => navigate("/dashboard", { replace:true }), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to accept this invitation.");
    } finally { setBusy(false); }
  }

  const signedInForInvite = !!user && !!preview && user.email.toLowerCase() === preview.email.toLowerCase();
  const signedInWrongEmail = !!user && !!preview && user.email.toLowerCase() !== preview.email.toLowerCase();

  return <section className="auth-page"><div className="auth-card">
    <div className="auth-heading"><p className="section-kicker">Workspace invitation</p><h1>Join {preview?.company_name || "this AGATA workspace"}.</h1><p>{preview ? <>You've been invited as <strong>{preview.role_name}</strong> using <strong>{preview.email}</strong>.</> : "Checking your invitation…"}</p></div>
    {preview && signedInForInvite && <div className="auth-form"><p>You are signed in as <strong>{user.email}</strong>. Accepting this invitation will add this account to the workspace with the invited role.</p>{error && <div className="auth-error" role="alert">{error}</div>}{success && <div className="auth-success" role="status">{success}</div>}<button className="primary-button auth-submit" type="button" disabled={busy} onClick={acceptExistingUser}>{busy ? "Joining workspace…" : "Accept invitation"}<span>→</span></button></div>}
    {preview && signedInWrongEmail && <div className="auth-error" role="alert">This invitation is for <strong>{preview.email}</strong>, but you are signed in as <strong>{user.email}</strong>. Sign out and open the invitation with the invited account.</div>}
    {preview && !user && <form className="auth-form" onSubmit={acceptNewUser}>
      <label>Your name<input autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} required minLength={2} /></label>
      <label>Password<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {success && <div className="auth-success" role="status">{success}</div>}
      <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Joining workspace…" : "Accept invitation"}<span>→</span></button>
    </form>}
    {!preview && error && <div className="auth-error" role="alert">{error}</div>}
    {!user && <p className="auth-switch">Already have an AGATA account? <Link to={`/login?redirect=${encodeURIComponent(`/accept-invitation?token=${token}`)}`}>Sign in</Link></p>}
    {signedInWrongEmail && <p className="auth-switch"><Link to="/">Return to AGATA</Link></p>}
  </div></section>;
}
