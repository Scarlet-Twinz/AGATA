import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const message = await signUp(companyName.trim(), fullName.trim(), email.trim(), password, acceptedTerms);
      setSuccess(message);
      window.setTimeout(() => navigate(`/login?email=${encodeURIComponent(email.trim())}`, { replace: true }), 1200);
    } catch (err) {
      let message = "Unable to create your workspace. Please try again.";
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { detail?: string };
          message = parsed.detail ?? err.message;
        } catch {
          message = err.message || message;
        }
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-page auth-page-signup">
      <div className="auth-card auth-card-wide">
        <div className="auth-heading">
          <p className="section-kicker">Start with AGATA</p>
          <h1>Create your workspace.</h1>
          <p>Bring your projects, contractors, requirements, and evidence into one readiness workflow.</p>
        </div>
        <form className="auth-form auth-form-grid" onSubmit={handleSubmit}>
          <label>Company name<input type="text" autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Your company" required minLength={2} maxLength={160} /></label>
          <label>Your name<input type="text" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" required minLength={2} maxLength={160} /></label>
          <label className="auth-field-full">Work email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required /></label>
          <label>Confirm password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat your password" required /></label>
          <label className="auth-checkbox auth-field-full"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>I agree to the <Link to="/terms" target="_blank">Terms</Link> and acknowledge the <Link to="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
          {error && <div className="auth-error auth-field-full" role="alert">{error}</div>}
          {success && <div className="auth-success auth-field-full" role="status">{success} Check your inbox, then sign in after verification.</div>}
          <button className="primary-button auth-submit auth-field-full" type="submit" disabled={submitting}>{submitting ? "Creating workspace…" : "Create workspace"}<span>→</span></button>
        </form>
        <p className="auth-switch">Already have an AGATA account? <Link to="/login">Sign in</Link></p>
      </div>
    </section>
  );
}
