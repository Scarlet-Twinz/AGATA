import { FormEvent, useState } from "react";

export function ContactPage() {
  const [openedMail, setOpenedMail] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const topic = String(form.get("topic") || "AGATA enquiry");
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const message = String(form.get("message") || "");
    const subject = encodeURIComponent(`[AGATA] ${topic}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`);
    window.location.href = `mailto:anthony@anthonytech.ng?subject=${subject}&body=${body}`;
    setOpenedMail(true);
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
          <label>Message<textarea required name="message" rows={5} placeholder="Tell us what you need..." /></label>
          <button className="primary-button" type="submit">{openedMail ? "Email draft opened ✓" : "Continue to email →"}</button>
          <small>Your message will open in your email app addressed to <a href="mailto:anthony@anthonytech.ng">anthony@anthonytech.ng</a>. No message is stored by this website yet.</small>
        </form>
      </div>
    </section>
  );
}
