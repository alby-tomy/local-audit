"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Users,
  Zap,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";
import { AmbientBackground } from "@/components/ambient-background";
import { ThemeSwitcher } from "@/components/theme-switcher";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: Zap },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <AmbientBackground />
        <div className="h-9 w-9 rounded-full border-2 border-edge border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen">
      <AmbientBackground />

      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-edge bg-surface/50 backdrop-blur-xl">
        <div className="px-6 py-5 border-b border-edge/70">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent2 shadow-[0_0_20px_-4px_rgb(var(--accent)/0.6)]">
              <Sparkles className="h-4.5 w-4.5 text-accent-fg" />
            </span>
            <span className="font-display font-semibold text-fg text-lg tracking-tight">
              LocalAudit <span className="gradient-text">AI</span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  active
                    ? "text-fg bg-surface-2 shadow-[inset_0_0_0_1px_rgb(var(--edge))]"
                    : "text-muted hover:text-fg hover:bg-surface-2/60"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-to-b from-accent to-accent2 shadow-[0_0_10px_-1px_rgb(var(--accent)/0.8)]" />
                )}
                <Icon className={clsx("h-4 w-4 transition-colors", active ? "text-accent" : "text-muted group-hover:text-fg")} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-edge/70 space-y-3">
          <ThemeSwitcher className="w-full justify-center" />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-xs text-muted truncate">{user.email}</span>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
