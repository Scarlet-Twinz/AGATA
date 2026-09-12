import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    api<{ message: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "POST" })
      .then((result) => {
        setState("success");
        setMessage(result.message);
      })
      .catch((error) => {
        setState("error");
        setMessage(error instanceof Error ? error.message : "This verification link is invalid or expired.");
      });
  }, [token]);

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="auth-heading">
          <p className="section-kicker">Account verification</p>
          <h1>{state === "success" ? "Email verified." : state === "loading" ? "Verifying your email…" : "Verification needs attention."}</h1>
          <p>{message}</p>
        </div>
        {state !== "loading" && <Link className="primary-button auth-submit" to="/login">Continue to sign in <span>→</span></Link>}
      </div>
    </section>
  );
}
