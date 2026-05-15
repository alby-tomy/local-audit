import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...(options ?? {}) });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...(options ?? {}) });
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: "", ...(options ?? {}) });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: "", ...(options ?? {}), maxAge: 0 });
        },
      },
    },
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const { data: userRow } = await supabase
      .from("users")
      .select("tenant:tenants(subscription_status, credits_used, credits_limit)")
      .eq("auth_user_id", session.user.id)
      .single();

    const tenant = userRow?.tenant as { subscription_status?: string } | null;
    if (tenant?.subscription_status === "canceled") {
      return NextResponse.redirect(new URL("/dashboard/billing", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/billing/portal"],
};
