import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/audits", label: "Audits" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/api-docs", label: "API Docs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>Dashboard</h1>
        <nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="badge">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </main>
  );
}
