import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { createPortalSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as { returnUrl?: string };
  const returnUrl = payload.returnUrl ?? "http://localhost:3000/dashboard/billing";

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...(options ?? {}) });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("tenant:tenants(stripe_customer_id)")
    .eq("auth_user_id", session.user.id)
    .single();

  const stripeCustomerId = (userRow?.tenant as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer linked" }, { status: 400 });
  }

  const portalSession = await createPortalSession(stripeCustomerId, returnUrl);
  return NextResponse.json({ url: portalSession.url });
}
