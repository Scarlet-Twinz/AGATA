import { FormEvent, useState } from "react";
import { api } from "../lib/api";

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSending(true);
    setSubmitted(false);
    setError("");
    try {
      await api<{ accepted: boolean }>("/api/support", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          email: String(form.get("email") || ""),
          topic: String(form.get("topic") || "support"),
          message: String(form.get("message") || ""),
        }),
      });
      formElement.reset();
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AGATA could not send your message. Please email support directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="contact-page">
      <div className="contact-intro">
        <p className="section-kicker">Contact & support</p>
        <h1>Let's make compliance easier.</h1>
        <p>Have a question, need help understanding AGATA, or want to talk about bringing it to your team? Reach out directly or send a message.</p>
        <div className="contact-direct">
          <a href="mailto:anthony@anthonytech.ng"><span>Email</span><strong>anthony@anthonytech.ng</strong></a>
          <a href="tel:09031530359"><span>Phone</span><strong>09031530359</strong></a>
        </div>
        <div className="support-cards">
          <div><span>Support</span><strong>Get help with AGATA</strong><p>Questions about your workspace, evidence, readiness, or Rumi.</p></div>
          <div><span>Business</span><strong>Talk to the founder</strong><p>Interested in AGATA for your organization? Tell us what you're building.</p></div>
        </div>
      </div>
      <div className="contact-form-wrap">
        <form onSubmit={handleSubmit}>
          <div className="form-title"><span>AGATA CONTACT</span><h2>How can we help?</h2></div>
          <label>Name<input required name="name" placeholder="Your name" /></label>
          <label>Email<input required type="email" name="email" placeholder="you@company.com" /></label>
          <label>What can we help with?<select name="topic" defaultValue="support"><option value="support">Product support</option><option value="readiness">Readiness question</option><option value="business">Business enquiry</option><option value="other">Something else</option></select></label>
          <label>Message<textarea required name="message" minLength={10} rows={5} placeholder="Tell us what you need..." /></label>
          {submitted && <div role="status">Message sent ✓ We’ll get back to you.</div>}
          {error && <div role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={sending}>{sending ? "Sending…" : "Send message →"}</button>
          <small>Your message is sent through AGATA's support API. If delivery is unavailable, you can email <a href="mailto:anthony@anthonytech.ng">anthony@anthonytech.ng</a> directly.</small>
        </form>
      </div>
    </section>
  );
}
