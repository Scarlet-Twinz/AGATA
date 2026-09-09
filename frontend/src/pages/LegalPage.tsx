import { Link, useLocation } from "react-router-dom";

const legalContent = {
  "/privacy": {
    kicker: "Privacy",
    title: "Privacy, explained plainly.",
    intro: "AGATA is being built with a simple principle: people should understand what information a product needs, why it needs it, and how it is handled.",
    sections: [
      ["Information we expect to handle", "AGATA may handle account information, company and contractor details, project requirements, compliance evidence, and workspace activity needed to provide the service."],
      ["How information is used", "Information is used to operate the AGATA workspace, evaluate readiness, provide requested support, improve product reliability, and deliver features the customer chooses to use."],
      ["Evidence belongs to the workflow", "Documents and evidence are treated as part of a customer's compliance workflow. AGATA is designed to keep evidence connected to the requirement and decision it supports."],
      ["AI and Rumi", "Rumi is an optional intelligence layer. The core readiness workflow is designed around structured requirements and evidence rather than requiring an AI system to make the underlying compliance decision."],
      ["Security", "AGATA is under active development. Before production launch, security controls, access policies, retention practices, and operational safeguards will be documented and reviewed for the service being offered."],
      ["Questions", "For privacy questions or requests, contact AGATA at anthony@anthonytech.ng."],
    ],
  },
  "/terms": {
    kicker: "Terms of service",
    title: "Clear expectations for using AGATA.",
    intro: "These terms are presented as a product-stage draft while AGATA is being prepared for production launch. They describe the intended relationship between AGATA and its customers and will be finalized before commercial launch.",
    sections: [
      ["The service", "AGATA provides a workspace for organizing projects, contractors, requirements, evidence, and readiness information. Features may change as the product develops."],
      ["Customer responsibility", "Customers remain responsible for the accuracy of the information and evidence they enter, their internal approval processes, and the professional or regulatory decisions made from that information."],
      ["Readiness is decision support", "AGATA's readiness result is an evidence-led workflow output. It does not replace a customer's legal, regulatory, safety, procurement, or professional judgment."],
      ["Rumi", "Rumi may help explain workspace information or surface useful context. It is not presented as a compliance authority and should not be treated as a substitute for source evidence or qualified professional advice."],
      ["Acceptable use", "Customers should use AGATA lawfully and only with information they are authorized to provide. Attempts to compromise the service, abuse other users, or bypass access controls are not permitted."],
      ["Questions", "For questions about these terms, contact AGATA at anthony@anthonytech.ng."],
    ],
  },
} as const;

export function LegalPage() {
  const location = useLocation();
  const data = legalContent[location.pathname as keyof typeof legalContent] ?? legalContent["/privacy"];

  return (
    <section className="info-page legal-page">
      <div className="info-hero">
        <p className="section-kicker">{data.kicker}</p>
        <h1>{data.title}</h1>
        <p>{data.intro}</p>
      </div>
      <div className="info-grid legal-grid">
        {data.sections.map(([title, text], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </div>
      <div className="info-cta">
        <h2>Need to talk to us?</h2>
        <p>Questions about AGATA, privacy, or how the product works? We are happy to help.</p>
        <Link className="primary-button" to="/contact">Contact AGATA <span>→</span></Link>
      </div>
    </section>
  );
}
