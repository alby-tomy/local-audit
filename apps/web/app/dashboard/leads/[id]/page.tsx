"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { leadsApi } from "@/lib/api";
import { ArrowLeft, Mail, ExternalLink, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { clsx } from "clsx";

interface Issue {
  code: string;
  title: string;
  impact: string;
  severity: string;
  detail: string | null;
}

interface Lead {
  id: string;
  business_name: string;
  category: string;
  city: string;
  website: string;
  email: string | null;
  phone: string | null;
  score: number | null;
  priority: string;
  status: string;
  issues: Issue[];
  report_text: string | null;
  load_time_seconds: number | null;
  email_sent: boolean;
  follow_up_1_sent: boolean;
  follow_up_2_sent: boolean;
  replied: boolean;
  converted: boolean;
  deal_value: number | null;
  created_at: string;
}

// Tailwind's content scanner can't resolve `badge-${priority}` template literals —
// spelling out the literal class names here keeps .badge-high/.badge-medium in the build.
const BADGE_CLASS: Record<string, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-4 w-4 text-rose-400" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  medium: <Clock className="h-4 w-4 text-amber-400" />,
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [emailType, setEmailType] = useState("problem_loss");
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    leadsApi.get(id).then((res) => setLead(res.data)).finally(() => setLoading(false));
  }, [id]);

  const sendEmail = async () => {
    if (!lead) return;
    setSending(true);
    try {
      const payload: { email_type: string; custom_subject?: string; custom_body?: string } = { email_type: emailType };
      if (editMode && customSubject) payload.custom_subject = customSubject;
      if (editMode && customBody) payload.custom_body = customBody;
      const res = await leadsApi.sendEmail(id, payload);
      setLead(res.data);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const markReplied = async () => {
    const res = await leadsApi.update(id, { replied: true });
    setLead(res.data);
  };

  const markConverted = async () => {
    const value = prompt("Enter deal value ($):");
    if (value === null) return;
    const res = await leadsApi.update(id, { converted: true, deal_value: parseFloat(value) || 0 });
    setLead(res.data);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-full border-2 border-edge border-t-accent animate-spin" /></div>;
  if (!lead) return <div className="text-center text-muted mt-20">Lead not found.</div>;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 text-muted hover:text-fg text-sm transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </button>

      {/* Header */}
      <div className="card p-6 animate-fade-up">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-fg">{lead.business_name}</h1>
            <p className="text-muted">{lead.category} · {lead.city}</p>
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-accent hover:underline underline-offset-4 mt-1">
                {lead.website} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="text-right">
            <div className={clsx(
              "font-display text-4xl font-bold",
              (lead.score ?? 0) <= 40 ? "text-rose-400" : (lead.score ?? 0) <= 70 ? "text-amber-400" : "text-emerald-400"
            )}>
              {lead.score ?? "?"}<span className="text-lg text-muted">/100</span>
            </div>
            <div className={clsx(BADGE_CLASS[lead.priority || "medium"] || BADGE_CLASS.medium, "mt-1.5 inline-flex text-sm")}>{lead.priority} priority</div>
          </div>
        </div>

        {/* Outcome actions */}
        <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-edge/70">
          {!lead.replied && (
            <button type="button" onClick={markReplied} className="btn-secondary">
              <CheckCircle className="h-4 w-4 text-amber-400" /> Mark Replied
            </button>
          )}
          {!lead.converted && (
            <button type="button" onClick={markConverted} className="btn-secondary">
              <CheckCircle className="h-4 w-4 text-emerald-400" /> Mark Converted
            </button>
          )}
          {lead.converted && (
            <span className="badge-low px-3 py-1.5 text-sm">
              Converted {lead.deal_value ? `— $${lead.deal_value}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Issues */}
      <div className="card animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="p-5 border-b border-edge/70">
          <h2 className="font-display font-semibold text-fg">{lead.issues.length} Issues Found</h2>
          {lead.load_time_seconds && (
            <p className="text-sm text-muted mt-0.5">Page load time: {lead.load_time_seconds}s</p>
          )}
        </div>
        <div className="divide-y divide-edge/60">
          {lead.issues.map((issue) => (
            <div key={issue.code} className="p-5 flex gap-4">
              <div className="mt-0.5">{SEVERITY_ICON[issue.severity] || <AlertTriangle className="h-4 w-4 text-muted" />}</div>
              <div>
                <p className="font-medium text-fg">{issue.title}</p>
                <p className="text-sm text-muted mt-0.5">{issue.impact}</p>
                {issue.detail && <p className="text-xs text-muted/70 mt-1">{issue.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Report */}
      {lead.report_text && (
        <div className="card p-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <h2 className="font-display font-semibold text-fg mb-3">AI Audit Report</h2>
          <div className="prose prose-sm max-w-none text-muted whitespace-pre-line">
            {lead.report_text}
          </div>
        </div>
      )}

      {/* Outreach */}
      <div className="card p-6 animate-fade-up" style={{ animationDelay: "180ms" }}>
        <h2 className="font-display font-semibold text-fg mb-4">Outreach</h2>

        {lead.email ? (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-sm text-muted">To: <strong className="text-fg">{lead.email}</strong></span>
              {lead.email_sent && <span className="badge-low">Initial email sent</span>}
              {lead.follow_up_1_sent && <span className="badge-low">Follow-up 1 sent</span>}
              {lead.follow_up_2_sent && <span className="badge-low">Follow-up 2 sent</span>}
            </div>

            {!lead.email_sent && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {["problem_loss", "value_first", "curiosity"].map((t) => (
                    <button key={t} type="button" onClick={() => setEmailType(t)}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 capitalize",
                        emailType === t
                          ? "bg-gradient-to-r from-accent to-accent2 text-accent-fg shadow-[0_0_16px_-4px_rgb(var(--accent)/0.6)]"
                          : "bg-surface-2 text-muted hover:text-fg border border-edge"
                      )}>
                      {t.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)}
                    className="rounded border-edge bg-base-2 text-accent focus:ring-accent/40" />
                  Edit email before sending
                </label>

                {editMode && (
                  <div className="space-y-2">
                    <input className="input" aria-label="Subject line" placeholder="Subject line" value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)} />
                    <textarea className="input h-36 resize-none" aria-label="Email body" placeholder="Email body..." value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)} />
                  </div>
                )}

                <button type="button" onClick={sendEmail} disabled={sending} className="btn-primary">
                  <Mail className="h-4 w-4" />
                  {sending ? "Sending..." : "Send Outreach Email"}
                </button>
              </div>
            )}

            {lead.email_sent && !lead.follow_up_1_sent && (
              <button
                type="button"
                onClick={() => leadsApi.sendFollowUp(id, 1).then((r) => setLead(r.data))}
                className="btn-secondary"
              >
                <Mail className="h-4 w-4" /> Send Follow-up 1 (Day 3)
              </button>
            )}
            {lead.follow_up_1_sent && !lead.follow_up_2_sent && (
              <button
                type="button"
                onClick={() => leadsApi.sendFollowUp(id, 2).then((r) => setLead(r.data))}
                className="btn-secondary"
              >
                <Mail className="h-4 w-4" /> Send Follow-up 2 (Final)
              </button>
            )}
          </>
        ) : (
          <p className="text-muted text-sm">No email address found for this lead. Add one to enable outreach.</p>
        )}
      </div>
    </div>
  );
}
