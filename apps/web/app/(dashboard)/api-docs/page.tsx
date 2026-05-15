export default function ApiDocsPage() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return (
    <section className="card">
      <h2>API Docs</h2>
      <p>
        FastAPI OpenAPI docs: <a href={`${base}/docs`}>{base}/docs</a>
      </p>
    </section>
  );
}
