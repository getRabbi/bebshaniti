export function PagePlaceholder({ title, phase }: { title: string; phase: number }) {
  return (
    <section>
      <h1>{title}</h1>
      <div className="page-card">
        <p className="muted">
          The authenticated production shell is ready. Data operations are intentionally unavailable
          until the Phase {phase} API and permission tests are implemented.
        </p>
      </div>
    </section>
  );
}
