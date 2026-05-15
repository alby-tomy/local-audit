import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { createCheckoutSession } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { priceId?: string; country?: string };
  if (!body.priceId) {
    return NextResponse.json({ error: "priceId is required" }, { status: 400 });
  }

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
    .select("tenant_id, email")
    .eq("auth_user_id", session.user.id)
    .single();

  if (!userRow?.tenant_id) {
    return NextResponse.json({ error: "Tenant not provisioned" }, { status: 400 });
  }

  const hdrs = headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const checkout = await createCheckoutSession({
    priceId: body.priceId,
    tenantId: userRow.tenant_id,
    userId: session.user.id,
    customerEmail: userRow.email ?? session.user.email ?? "",
    successUrl: `${baseUrl}/dashboard/billing`,
    cancelUrl: `${baseUrl}/pricing`,
    currency: "usd",
  });

  return NextResponse.json({ url: checkout.url });
}
