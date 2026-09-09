import { Link, useLocation } from "react-router-dom";

const content = {
  "/how-it-works": {
    kicker: "How it works",
    title: "A clearer path from requirement to readiness.",
    intro: "AGATA connects the pieces teams normally manage across spreadsheets, folders, inboxes, and conversations, then turns them into a workflow your team can actually act on.",
    sections: [
      ["Define the work", "Create a project and establish the requirements that must be satisfied before a contractor can be considered ready."],
      ["Bring in contractors", "Create contractor profiles and keep the evidence associated with the people and organizations doing the work."],
      ["Connect evidence", "Map certificates and other evidence to the requirements they satisfy instead of leaving your team to guess what a document means."],
      ["Evaluate readiness", "AGATA checks the evidence against the project's requirements and produces an explainable readiness result."],
      ["See what needs attention", "When something is missing, invalid, or not configured, the workflow tells your team what needs to happen next."],
      ["Keep the decision visible", "The result stays connected to the project and contractor so readiness is not buried in an email thread or spreadsheet."],
    ],
  },
  "/about": {
    kicker: "About AGATA",
    title: "Compliance work deserves better tools.",
    intro: "AGATA is being built around a simple belief: teams should be able to understand readiness without reconstructing the story from scattered evidence.",
    sections: [
      ["The problem we care about", "Important compliance decisions are often slowed down by disconnected requirements, documents, people, and deadlines. AGATA is designed to bring those pieces together."],
      ["Our mission", "Make evidence-led compliance decisions easier to understand, easier to explain, and easier to act on."],
      ["Our approach", "Start with a dependable rules-based foundation, then use intelligence where it genuinely improves the experience. AI should assist the workflow, not quietly replace its source of truth."],
      ["Our vision", "Build a platform where project teams can see readiness across their work before compliance becomes a last-minute problem."],
      ["Built deliberately", "AGATA has its own product identity and workflow. We study the problems teams face without copying another platform's interface, language, or implementation."],
      ["A founder-led product", "AGATA is being built hands-on, with the product shaped around real workflow problems rather than a collection of features added simply because they are fashionable."],
    ],
  },
};

const faqs = [
  ["What is AGATA?", "AGATA is a compliance intelligence platform that connects projects, contractors, requirements, and evidence to produce explainable readiness decisions."],
  ["Who is AGATA for?", "AGATA is designed for teams that need to verify whether contractors, suppliers, or other external parties have the evidence required for a project before work moves forward."],
  ["How does readiness work?", "A project has requirements. Evidence is connected to those requirements, and AGATA evaluates whether the required evidence is present and valid. The result explains what is satisfied and what still needs attention."],
  ["What happens when evidence is missing?", "AGATA identifies the missing or invalid requirement so the team has a concrete next step instead of searching through folders or messages."],
  ["Can requirements be reused?", "Yes. AGATA includes a reusable requirement library so common requirements can be applied across projects instead of recreated every time."],
  ["Is Rumi the compliance authority?", "No. Rumi is AGATA's intelligence layer. It can explain workspace information and help users understand what needs attention, while the deterministic readiness workflow remains the source of truth for readiness."],
  ["Does AGATA replace our existing compliance process?", "AGATA is designed to organize and strengthen the evidence and readiness part of the process. Your team's policies, approvals, and professional judgment remain important."],
  ["Can I use AGATA without AI?", "Yes. The core readiness workflow is designed to work from structured requirements and evidence. Rumi is an additional intelligence layer, not a requirement for the underlying decision workflow."],
  ["Is AGATA ready for every industry?", "AGATA is being built to support evidence-led workflows across different types of projects. Industry-specific requirements and deeper workflows will grow over time."],
];

export function PublicInfoPage() {
  const location = useLocation();

  if (location.pathname === "/faq") {
    return (
      <section className="info-page faq-page">
        <div className="info-hero">
          <p className="section-kicker">FAQ</p>
          <h1>Questions people ask first.</h1>
          <p>A practical starting point for teams evaluating AGATA. If your question is not answered here, our support team is only a message away.</p>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details className="faq-item" key={question} open={index === 0}>
              <summary><span>{question}</span><b>+</b></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <div className="info-cta">
          <p className="section-kicker">Still have a question?</p>
          <h2>Talk to AGATA support.</h2>
          <p>Tell us what you are trying to solve and we can point you in the right direction.</p>
          <Link className="primary-button" to="/contact">Contact support <span>→</span></Link>
        </div>
      </section>
    );
  }

  const data = content[location.pathname as keyof typeof content] ?? content["/about"];

  return (
    <section className="info-page">
      <div className="info-hero">
        <p className="section-kicker">{data.kicker}</p>
        <h1>{data.title}</h1>
        <p>{data.intro}</p>
      </div>
      <div className="info-grid">
        {data.sections.map(([title, text], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      {location.pathname === "/about" && (
        <div className="founder-note">
          <div>
            <p className="section-kicker">The idea behind AGATA</p>
            <h2>Built from a question. Named for a reason.</h2>
          </div>
          <div className="founder-story">
            <p>AGATA carries the name of my mother.</p>
            <p>She is the person whose strength, love, and sacrifice helped make me who I am. She is one of the deepest reasons behind the person I am becoming and the things I am determined to build.</p>
            <p>So AGATA is more than a product name. It is a reminder of where the journey began—and of the person who gave me the reason to keep building.</p>
            <div className="founder-signature"><strong>Anthony Emmanuella Mmasinachi</strong><span>Founder, AGATA</span></div>
          </div>
        </div>
      )}
      <div className="info-cta">
        <h2>See AGATA in action.</h2>
        <p>Start with a workspace and turn your next compliance decision into a clear workflow.</p>
        <Link className="primary-button" to="/signup">Get started <span>→</span></Link>
      </div>
    </section>
  );
}
