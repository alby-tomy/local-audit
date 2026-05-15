import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <div className="card">
        <h1>LocalAudit AI</h1>
        <p>Multi-tenant SaaS for automated audits, AI fix generation, and client delivery workflows.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link className="button" href="/pricing">
            View Pricing
          </Link>
          <Link className="button" href="/dashboard">
            Open Dashboard
          </Link>
          <Link className="button" href="/privacy">
            Privacy
          </Link>
        </div>
      </div>
    </main>
  );
}
