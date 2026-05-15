export default function DashboardHomePage() {
  return (
    <section className="grid grid-3">
      <article className="card">
        <h2>Credits Remaining</h2>
        <p style={{ fontSize: 28, margin: 0 }}>--</p>
      </article>
      <article className="card">
        <h2>Audits This Cycle</h2>
        <p style={{ fontSize: 28, margin: 0 }}>--</p>
      </article>
      <article className="card">
        <h2>Conversion Value</h2>
        <p style={{ fontSize: 28, margin: 0 }}>--</p>
      </article>
    </section>
  );
}
