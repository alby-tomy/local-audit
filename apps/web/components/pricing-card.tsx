"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  priceUsd: number;
  credits: number;
  stripePriceId: string;
  features: string[];
  popular?: boolean;
};

export function PricingCard({ plan, country }: { plan: Plan; country: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCheckout = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: plan.stripePriceId, planId: plan.id, country }),
      });
      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ borderColor: plan.popular ? "#0057ff" : "var(--border)" }}>
      {plan.popular && <span className="badge">Most Popular</span>}
      <h3>{plan.name}</h3>
      <p style={{ fontSize: 28, margin: "8px 0" }}>${plan.priceUsd}/mo</p>
      <p style={{ color: "var(--muted)" }}>{plan.credits} audits / month</p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <button className="button" onClick={onCheckout} disabled={loading}>
        {loading ? "Redirecting..." : "Start 14-day Trial"}
      </button>
      {error && <p style={{ color: "#b00020", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
