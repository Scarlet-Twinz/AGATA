import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("Enter the 6-digit code we sent to your email.");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setState("idle");
    try {
      const result = await api<{ message: string }>("/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code }),
      });
      setState("success");
      setMessage(result.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "This verification code is invalid or expired.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (!email.trim()) {
      setState("error");
      setMessage("Enter your email address first.");
      return;
    }
    setResending(true);
    setState("idle");
    try {
      const result = await api<{ message: string }>("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setMessage(result.message);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Unable to resend the verification code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-heading">
          <p className="section-kicker">Account verification</p>
          <h1>{state === "success" ? "Email verified." : "Verify your email."}</h1>
          <p>{message}</p>
        </div>
        {state !== "success" && (
          <form className="auth-form" onSubmit={handleVerify}>
            <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
            <label>Verification code<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} required /></label>
            {state === "error" && <div className="auth-error" role="alert">{message}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={submitting || code.length !== 6}>{submitting ? "Verifying…" : "Verify email"}<span>→</span></button>
            <button className="secondary-button" type="button" onClick={resendCode} disabled={resending}>{resending ? "Sending…" : "Resend verification code"}</button>
          </form>
        )}
        {state === "success" && <Link className="primary-button auth-submit" to="/login">Continue to sign in <span>→</span></Link>}
      </div>
    </section>
  );
}
