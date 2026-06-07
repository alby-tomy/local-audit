"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CheckCircle, AlertCircle, Key, Mail, User } from "lucide-react";

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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your API keys and email credentials.</p>
      </div>

      {/* Status badges */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`card p-4 flex items-center gap-3 ${settings?.anthropic_api_key_set ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {settings?.anthropic_api_key_set
            ? <CheckCircle className="h-5 w-5 text-green-600" />
            : <AlertCircle className="h-5 w-5 text-amber-500" />}
          <div>
            <p className="text-sm font-medium text-slate-900">Anthropic (Claude)</p>
            <p className="text-xs text-slate-500">{settings?.anthropic_api_key_set ? "API key configured" : "Not configured"}</p>
          </div>
        </div>
        <div className={`card p-4 flex items-center gap-3 ${settings?.gmail_configured ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          {settings?.gmail_configured
            ? <CheckCircle className="h-5 w-5 text-green-600" />
            : <AlertCircle className="h-5 w-5 text-amber-500" />}
          <div>
            <p className="text-sm font-medium text-slate-900">Gmail Outreach</p>
            <p className="text-xs text-slate-500">{settings?.gmail_configured ? settings.gmail_address! : "Not configured"}</p>
          </div>
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        {/* Profile */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" /> Profile
          </h2>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Account Email</label>
            <input className="input bg-slate-50 cursor-not-allowed" value={user?.email || ""} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name" />
          </div>
        </div>

        {/* Anthropic */}
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-500" /> Anthropic API Key
          </h2>
          <p className="text-sm text-slate-500">
            Used to generate AI audit reports and outreach emails.
            Get your key at <strong>console.anthropic.com</strong>.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Key {settings?.anthropic_api_key_set && <span className="text-green-600">(set — leave blank to keep current)</span>}
            </label>
            <input
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
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Mail className="h-4 w-4 text-slate-500" /> Gmail Outreach
          </h2>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            Use a Gmail App Password (not your regular password).
            Enable 2FA on your Google account, then go to{" "}
            <strong>myaccount.google.com/apppasswords</strong> to generate one.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gmail Address</label>
            <input className="input" type="email" value={gmailAddress}
              onChange={(e) => setGmailAddress(e.target.value)}
              placeholder="you@gmail.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              App Password {settings?.gmail_configured && <span className="text-green-600">(set — leave blank to keep current)</span>}
            </label>
            <input
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
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" /> Settings saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
