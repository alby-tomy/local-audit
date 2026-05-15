export default function AuditDetailPage({ params }: { params: { id: string } }) {
  return (
    <section className="card">
      <h2>Audit Detail</h2>
      <p>Audit ID: {params.id}</p>
      <p>Use this page to show issue list, score, screenshots, and fix status timeline.</p>
    </section>
  );
}
