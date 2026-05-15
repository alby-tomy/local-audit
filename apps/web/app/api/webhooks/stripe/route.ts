import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { constructWebhookEvent, stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

function hashApiKey(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string {
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (typeof subscription === "string") {
    return subscription;
  }
  if (subscription && "id" in subscription) {
    return subscription.id;
  }
  return "";
}

async function generateAndStoreApiKey(tenantId: string) {
  const rawKey = `la_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = rawKey.slice(0, 8);
  const keyHash = hashApiKey(rawKey);

  await supabaseAdmin.from("api_keys").insert({
    tenant_id: tenantId,
    name: "Default API Key",
    key_prefix: prefix,
    key_hash: keyHash,
    scopes: ["audit:read", "audit:create"],
  });

  return rawKey;
}

async function sendWelcomeEmail(email: string, planName: string | null, apiKey: string) {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL ?? "noreply@localauditai.com",
      to: [email],
      subject: "Welcome to LocalAudit AI",
      html: `<p>Your ${planName ?? "plan"} trial is active.</p><p>API key: <code>${apiKey}</code></p>`,
    }),
  });
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ status: "already_processed" });
  }

  await supabaseAdmin.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    payload: event,
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") {
        break;
      }

      const tenantId = session.metadata?.tenant_id;
      const subscriptionId = session.subscription as string;
      if (!tenantId || !subscriptionId) {
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const periodItem = subscription.items.data[0];
      const priceId = subscription.items.data[0]?.price?.id;

      const { data: plan } = await supabaseAdmin
        .from("plans")
        .select("id, display_name, monthly_credits")
        .eq("stripe_price_id", priceId)
        .maybeSingle();

      await supabaseAdmin
        .from("tenants")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscriptionId,
          plan_id: plan?.id,
          subscription_status: "active",
          credits_limit: plan?.monthly_credits ?? 50,
          credits_used: 0,
          billing_cycle_start: new Date(
            (periodItem?.current_period_start ?? subscription.start_date) * 1000,
          ).toISOString(),
          billing_cycle_end: new Date(
            (periodItem?.current_period_end ?? subscription.start_date) * 1000,
          ).toISOString(),
          currency: session.currency ?? "usd",
        })
        .eq("id", tenantId);

      const apiKey = await generateAndStoreApiKey(tenantId);
      if (session.customer_email) {
        await sendWelcomeEmail(session.customer_email, plan?.display_name ?? null, apiKey);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        break;
      }
      await supabaseAdmin
        .from("tenants")
        .update({
          credits_used: 0,
          subscription_status: "active",
          billing_cycle_start: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscriptionId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabaseAdmin
        .from("tenants")
        .update({ subscription_status: "canceled", credits_limit: 0 })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) {
        break;
      }
      await supabaseAdmin
        .from("tenants")
        .update({ subscription_status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);
      break;
    }

    default:
      break;
  }

  await supabaseAdmin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("stripe_event_id", event.id);

  return NextResponse.json({ received: true });
}
