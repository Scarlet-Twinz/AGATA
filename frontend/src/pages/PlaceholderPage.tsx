type Props = { title: string; description?: string };

export function PlaceholderPage({ title, description }: Props) {
  return (
    <section className="page workspace-placeholder-page">
      <p className="eyebrow">AGATA WORKSPACE</p>
      <h1>{title}</h1>
      <p className="workspace-placeholder-description">{description ?? `Your ${title.toLowerCase()} workspace.`}</p>
      <div className="panel empty-state"><strong>{title} workspace</strong><span>This area is mapped into the AGATA workspace and will connect to live data as the core workflow is implemented.</span></div>
    </section>
  );
}
