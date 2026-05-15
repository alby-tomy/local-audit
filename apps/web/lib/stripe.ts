import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

export async function createCheckoutSession({
  priceId,
  tenantId,
  userId,
  customerEmail,
  successUrl,
  cancelUrl,
  currency = "usd",
}: {
  priceId: string;
  tenantId: string;
  userId: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    currency,
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14,
      metadata: { tenant_id: tenantId, user_id: userId },
    },
    metadata: { tenant_id: tenantId, user_id: userId },
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
  });
}

export async function createPortalSession(stripeCustomerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

export function constructWebhookEvent(payload: string | Buffer, signature: string) {
  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET ?? "");
}
