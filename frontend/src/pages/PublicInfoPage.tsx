import { Link, useLocation } from "react-router-dom";

const content = {
  "/how-it-works": {
    kicker: "How it works",
    title: "A clearer path from requirement to readiness.",
    intro: "AGATA connects the pieces that teams normally manage across spreadsheets, folders, inboxes, and conversations.",
    sections: [
      ["Define", "Create a project and establish the requirements that matter for that work."],
      ["Connect", "Add contractors and connect their evidence to the requirements it satisfies."],
      ["Evaluate", "AGATA checks the evidence against the project's requirements and calculates readiness."],
      ["Act", "See what is missing, what is valid, and where your team needs to focus next."],
    ],
  },
  "/about": {
    kicker: "About AGATA",
    title: "Compliance work deserves better tools.",
    intro: "AGATA is being built around a simple belief: teams should be able to understand readiness without reconstructing the story from scattered evidence.",
    sections: [
      ["Our mission", "Make evidence-led compliance decisions easier to understand and easier to act on."],
      ["Our approach", "Start with a dependable rules-based foundation, then use intelligence where it genuinely improves the experience."],
      ["Our vision", "Build a platform where project teams can see readiness across their work before compliance becomes a last-minute problem."],
      ["Built deliberately", "AGATA is designed around its own workflow and product identity rather than copying an existing platform."],
    ],
  },
  "/faq": {
    kicker: "FAQ",
    title: "Questions people ask first.",
    intro: "A short starting point for teams evaluating AGATA.",
    sections: [
      ["What is AGATA?", "AGATA is a compliance intelligence platform that connects projects, contractors, requirements, and evidence to produce explainable readiness decisions."],
      ["Is Rumi the compliance authority?", "No. Rumi is an intelligence layer. AGATA's deterministic readiness workflow remains the source of truth for the decision."],
      ["Can requirements be reused?", "Yes. AGATA includes a reusable requirement library so teams can apply common requirements across projects."],
      ["What happens when evidence is missing?", "The readiness result identifies the missing or invalid requirement so the team knows what needs attention."],
    ],
  },
};

export function PublicInfoPage() {
  const location = useLocation();
  const data = content[location.pathname as keyof typeof content] ?? content["/faq"];
  return <section className="info-page"><div className="info-hero"><p className="section-kicker">{data.kicker}</p><h1>{data.title}</h1><p>{data.intro}</p></div><div className="info-grid">{data.sections.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</div><div className="info-cta"><h2>See AGATA in action.</h2><p>Start with a workspace and turn your next compliance decision into a clear workflow.</p><Link className="primary-button" to="/signup">Get started <span>→</span></Link></div></section>;
}
