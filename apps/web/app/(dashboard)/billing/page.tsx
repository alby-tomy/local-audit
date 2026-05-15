"use client";

import { useState } from "react";

export default function BillingPage() {
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    const res = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnUrl: window.location.href }),
    });

    if (!res.ok) {
      setError("Unable to open Stripe portal.");
      return;
    }

    const data = (await res.json()) as { url: string };
    window.location.href = data.url;
  }

  return (
    <section className="card">
      <h2>Billing</h2>
      <p>Manage plan changes, payment methods, and invoices in Stripe Customer Portal.</p>
      <button className="button" onClick={openPortal}>
        Open Billing Portal
      </button>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </section>
  );
}
