"use client";

import { FormEvent, useState } from "react";

export default function NewAuditPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      website_url: formData.get("website_url"),
      business_name: formData.get("business_name"),
      niche: formData.get("niche"),
      city: formData.get("city"),
      country: formData.get("country"),
    };

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/audits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      setMessage("Audit queued successfully.");
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audit request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Run New Audit</h2>
      <form onSubmit={onSubmit} className="grid" style={{ gap: 12 }}>
        <input required name="website_url" placeholder="https://business-site.com" />
        <input name="business_name" placeholder="Business name" />
        <input name="niche" placeholder="Niche" />
        <input name="city" placeholder="City" />
        <input name="country" placeholder="Country" />
        <button className="button" disabled={loading}>
          {loading ? "Queueing..." : "Queue Audit"}
        </button>
      </form>
      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </section>
  );
}
