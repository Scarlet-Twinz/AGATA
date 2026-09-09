import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type AuthPageProps = { mode: "login" | "signup" };

export function AuthPage({ mode }: AuthPageProps) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, signUp } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isSignup && !acceptedTerms) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        await signUp(companyName.trim(), fullName.trim(), email.trim(), password, acceptedTerms);
      } else {
        await signIn(email.trim(), password);
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      let message = "Something went wrong. Please try again.";
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

  const from = (location.state as { from?: string } | null)?.from;

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-story">
          <Link className="auth-brand" to="/" aria-label="AGATA home">
            <span className="auth-mark"><img src="/logo.png" alt="AGATA" /></span>
            <span>AGATA</span>
          </Link>
          <div className="auth-story-copy">
            <p className="section-kicker">Compliance intelligence</p>
            <h1>{isSignup ? "Build a clearer readiness workflow." : "Welcome back to AGATA."}</h1>
            <p>{isSignup ? "Bring projects, contractors, requirements, and evidence into one workspace built around the decisions your team needs to make." : "Sign in to review your projects, evidence, and contractor readiness."}</p>
          </div>
          <div className="auth-proof"><span>✓ Evidence-led</span><span>✓ Explainable</span><span>✓ Built for teams</span></div>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-heading">
            <p className="section-kicker">{isSignup ? "Get started" : "Sign in"}</p>
            <h2 id="auth-title">{isSignup ? "Create your workspace" : "Sign in to your workspace"}</h2>
            <p>{isSignup ? "Set up your AGATA company workspace in a few steps." : "Use the email and password connected to your AGATA account."}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && <>
              <label>Company name<input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Your company" autoComplete="organization" required minLength={2} maxLength={160} /></label>
              <label>Your name<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" autoComplete="name" required minLength={2} maxLength={160} /></label>
            </>}
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 8 characters" : "Your password"} autoComplete={isSignup ? "new-password" : "current-password"} required minLength={isSignup ? 8 : undefined} /></label>

            {isSignup && <label className="auth-checkbox"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>I agree to the <Link to="/terms" target="_blank">Terms</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.</span></label>}

            {error && <div className="auth-error" role="alert">{error}</div>}

            <button className="primary-button auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Please wait…" : isSignup ? "Create workspace" : "Sign in"}
            </button>
          </form>

          <div className="auth-switch">
            {isSignup ? <><span>Already have an account?</span><Link to="/login">Sign in</Link></> : <><span>New to AGATA?</span><Link to="/signup">Create a workspace</Link></>}
          </div>
          {from && <p className="auth-note">You can return to the page you were trying to access after signing in.</p>}
          <Link className="auth-back" to="/">← Back to AGATA</Link>
        </section>
      </div>
    </main>
  );
}
