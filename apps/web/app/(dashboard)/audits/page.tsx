import Link from "next/link";

const sampleAudits = [
  { id: "sample-1", website: "example.com", status: "completed", score: 82 },
  { id: "sample-2", website: "demo.org", status: "running", score: null },
];

export default function AuditsPage() {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>Audits</h2>
        <Link className="button" href="/dashboard/audits/new">
          Run Audit
        </Link>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Website</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th style={{ textAlign: "left" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {sampleAudits.map((audit) => (
            <tr key={audit.id}>
              <td>
                <Link href={`/dashboard/audits/${audit.id}`}>{audit.website}</Link>
              </td>
              <td>{audit.status}</td>
              <td>{audit.score ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
