export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="page">
      <p className="eyebrow">AGATA</p>
      <h1>{title}</h1>
      <div className="panel empty-state"><strong>{title} workspace</strong><span>This route is reserved for the V1 implementation. The backend domain is being built first so the UI connects to stable APIs rather than mocked data.</span></div>
    </section>
  );
}
