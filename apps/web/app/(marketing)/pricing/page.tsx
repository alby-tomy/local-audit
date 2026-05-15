import { headers } from "next/headers";

import { PricingCard } from "@/components/pricing-card";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 29,
    credits: 50,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE ?? "",
    features: ["50 audits/month", "AI report generation", "Email outreach", "Email support"],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 79,
    credits: 200,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE ?? "",
    features: ["200 audits/month", "AutoFix AI agent", "PDF delivery", "Priority support"],
    popular: true,
  },
  {
    id: "agency",
    name: "Agency",
    priceUsd: 199,
    credits: 999,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE ?? "",
    features: ["Unlimited audits", "White-label reports", "API access", "Team seats", "Dedicated support"],
  },
];

export default function PricingPage() {
  const headersList = headers();
  const country = headersList.get("cf-ipcountry") ?? "US";

  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 16 }}>
        <h1>Pricing</h1>
        <p>Global billing via Stripe with automatic tax calculation and local currency checkout.</p>
        <p style={{ color: "var(--muted)" }}>Detected country: {country}</p>
      </div>
      <section className="grid grid-3">
        {PLANS.map((plan) => (
          <PricingCard key={plan.id} plan={plan} country={country} />
        ))}
      </section>
    </main>
  );
}
