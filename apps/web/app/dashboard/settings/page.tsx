"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CheckCircle, AlertCircle, Key, Mail, User } from "lucide-react";
import { clsx } from "clsx";

interface Settings {
  full_name: string | null;
  email: string;
  anthropic_api_key_set: boolean;
  gmail_address: string | null;
  gmail_configured: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state — keys are never pre-filled (security)
  const [fullName, setFullName] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [gmailAddress, setGmailAddress] = useState("");
  const [gmailPassword, setGmailPassword] = useState("");

  useEffect(() => {
    settingsApi.get().then((res) => {
      setSettings(res.data);
      setFullName(res.data.full_name || "");
      setGmailAddress(res.data.gmail_address || "");
    }).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const payload: Record<string, string> = { full_name: fullName };
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;
      if (gmailAddress) payload.gmail_address = gmailAddress;
      if (gmailPassword) payload.gmail_app_password = gmailPassword;
      const res = await settingsApi.update(payload);
      setSettings(res.data);
      setSaved(true);
      setAnthropicKey("");
      setGmailPassword("");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-full border-2 border-edge border-t-accent animate-spin" /></div>;

  const StatusCard = ({ ok, title, subtitle }: { ok: boolean; title: string; subtitle: string }) => (
    <div className={clsx(
      "card p-4 flex items-center gap-3",
      ok ? "border-emerald-500/25" : "border-amber-500/25"
    )}>
      <div className={clsx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        ok ? "bg-emerald-500/10" : "bg-amber-500/10"
      )}>
        {ok ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <AlertCircle className="h-5 w-5 text-amber-400" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="text-xs text-muted truncate">{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-fg">Settings</h1>
        <p className="text-muted mt-1">Configure your API keys and email credentials.</p>
      </div>

      {/* Status badges */}
      <div className="grid grid-cols-2 gap-4">
        <StatusCard
          ok={!!settings?.anthropic_api_key_set}
          title="Anthropic (Claude)"
          subtitle={settings?.anthropic_api_key_set ? "API key configured" : "Not configured"}
        />
        <StatusCard
          ok={!!settings?.gmail_configured}
          title="Gmail Outreach"
          subtitle={settings?.gmail_configured ? settings!.gmail_address! : "Not configured"}
        />
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Profile */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-fg flex items-center gap-2">
            <User className="h-4 w-4 text-muted" /> Profile
          </h2>
          <div>
            <label className="label" htmlFor="settings-email">Account Email</label>
            <input id="settings-email" className="input opacity-60 cursor-not-allowed" value={user?.email || ""} disabled />
          </div>
          <div>
            <label className="label" htmlFor="settings-full-name">Full Name</label>
            <input id="settings-full-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name" />
          </div>
        </div>

        {/* Anthropic */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-fg flex items-center gap-2">
            <Key className="h-4 w-4 text-muted" /> Anthropic API Key
          </h2>
          <p className="text-sm text-muted">
            Used to generate AI audit reports and outreach emails.
            Get your key at <strong className="text-fg">console.anthropic.com</strong>.
          </p>
          <div>
            <label className="label" htmlFor="settings-anthropic-key">
              API Key {settings?.anthropic_api_key_set && <span className="text-emerald-400">(set — leave blank to keep current)</span>}
            </label>
            <input
              id="settings-anthropic-key"
              className="input font-mono"
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              placeholder={settings?.anthropic_api_key_set ? "sk-ant-••••••••••••" : "sk-ant-..."}
            />
          </div>
        </div>

        {/* Gmail */}
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-semibold text-fg flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted" /> Gmail Outreach
          </h2>
          <div className="p-3 rounded-xl border border-accent/25 bg-accent/10 text-sm text-fg">
            Use a Gmail App Password (not your regular password).
            Enable 2FA on your Google account, then go to{" "}
            <strong>myaccount.google.com/apppasswords</strong> to generate one.
          </div>
          <div>
            <label className="label" htmlFor="settings-gmail-address">Gmail Address</label>
            <input id="settings-gmail-address" className="input" type="email" value={gmailAddress}
              onChange={(e) => setGmailAddress(e.target.value)}
              placeholder="you@gmail.com" />
          </div>
          <div>
            <label className="label" htmlFor="settings-gmail-password">
              App Password {settings?.gmail_configured && <span className="text-emerald-400">(set — leave blank to keep current)</span>}
            </label>
            <input
              id="settings-gmail-password"
              className="input font-mono"
              type="password"
              value={gmailPassword}
              onChange={(e) => setGmailPassword(e.target.value)}
              placeholder={settings?.gmail_configured ? "xxxx-xxxx-xxxx-xxxx" : "16-character App Password"}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <CheckCircle className="h-4 w-4" /> Settings saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
