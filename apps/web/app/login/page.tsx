"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AmbientBackground } from "@/components/ambient-background";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isRegister) {
        await register(email, password, fullName);
      } else {
        await login(email, password);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <AmbientBackground />

      <div className="absolute top-6 right-6 z-10">
        <ThemeSwitcher />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-edge bg-surface/60 backdrop-blur-xl text-xs font-medium text-muted mb-5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI-powered local lead generation
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            <span className="gradient-text">LocalAudit</span>{" "}
            <span className="text-fg">AI</span>
          </h1>
          <p className="text-muted mt-2.5">Turn local businesses into clients — automatically.</p>
        </div>

        <div className="card p-8 relative">
          <div className="absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

          <h2 className="font-display text-xl font-semibold text-fg mb-6">
            {isRegister ? "Create your account" : "Welcome back"}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isRegister ? "Create Account" : "Sign In"}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="text-accent font-medium hover:underline underline-offset-4"
              onClick={() => { setIsRegister(!isRegister); setError(""); }}
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-muted/70 mt-6">
          localaudit.online · Built for freelancers who close deals
        </p>
      </div>
    </div>
  );
}
