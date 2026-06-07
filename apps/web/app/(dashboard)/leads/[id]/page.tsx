"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { leadsApi } from "@/lib/api";
import { ArrowLeft, Mail, ExternalLink, AlertTriangle, CheckCircle, Clock } from "lucide-react";

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

const SEVERITY_ICON: Record<string, React.ReactNode> = {
  critical: <AlertTriangle className="h-4 w-4 text-red-500" />,
  high: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  medium: <Clock className="h-4 w-4 text-amber-500" />,
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>;
  if (!lead) return <div className="text-center text-slate-500 mt-20">Lead not found.</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Leads
      </button>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{lead.business_name}</h1>
            <p className="text-slate-500">{lead.category} · {lead.city}</p>
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline mt-1">
                {lead.website} <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold ${(lead.score || 0) <= 40 ? "text-red-500" : (lead.score || 0) <= 70 ? "text-amber-500" : "text-green-500"}`}>
              {lead.score ?? "?"}<span className="text-lg text-slate-400">/100</span>
            </div>
            <div className={`mt-1 badge-${lead.priority || "medium"} text-sm`}>{lead.priority} priority</div>
          </div>
        </div>

        {/* Outcome actions */}
        <div className="flex flex-wrap gap-3 mt-6 pt-5 border-t border-slate-100">
          {!lead.replied && (
            <button onClick={markReplied} className="btn-secondary flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-amber-500" /> Mark Replied
            </button>
          )}
          {!lead.converted && (
            <button onClick={markConverted} className="btn-secondary flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" /> Mark Converted
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
      <div className="card">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">{lead.issues.length} Issues Found</h2>
          {lead.load_time_seconds && (
            <p className="text-sm text-slate-500 mt-0.5">Page load time: {lead.load_time_seconds}s</p>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {lead.issues.map((issue) => (
            <div key={issue.code} className="p-5 flex gap-4">
              <div className="mt-0.5">{SEVERITY_ICON[issue.severity] || <AlertTriangle className="h-4 w-4 text-slate-400" />}</div>
              <div>
                <p className="font-medium text-slate-900">{issue.title}</p>
                <p className="text-sm text-slate-600 mt-0.5">{issue.impact}</p>
                {issue.detail && <p className="text-xs text-slate-400 mt-1">{issue.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Report */}
      {lead.report_text && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-3">AI Audit Report</h2>
          <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-line">
            {lead.report_text}
          </div>
        </div>
      )}

      {/* Outreach */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Outreach</h2>

        {lead.email ? (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-sm text-slate-600">To: <strong>{lead.email}</strong></span>
              {lead.email_sent && <span className="badge-low">Initial email sent</span>}
              {lead.follow_up_1_sent && <span className="badge-low">Follow-up 1 sent</span>}
              {lead.follow_up_2_sent && <span className="badge-low">Follow-up 2 sent</span>}
            </div>

            {!lead.email_sent && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {["problem_loss", "value_first", "curiosity"].map((t) => (
                    <button key={t} onClick={() => setEmailType(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${emailType === t ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {t.replace("_", " ")}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} />
                  Edit email before sending
                </label>

                {editMode && (
                  <div className="space-y-2">
                    <input className="input" placeholder="Subject line" value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)} />
                    <textarea className="input h-36 resize-none" placeholder="Email body..." value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)} />
                  </div>
                )}

                <button onClick={sendEmail} disabled={sending} className="btn-primary flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {sending ? "Sending..." : "Send Outreach Email"}
                </button>
              </div>
            )}

            {lead.email_sent && !lead.follow_up_1_sent && (
              <button
                onClick={() => leadsApi.sendFollowUp(id, 1).then((r) => setLead(r.data))}
                className="btn-secondary flex items-center gap-2"
              >
                <Mail className="h-4 w-4" /> Send Follow-up 1 (Day 3)
              </button>
            )}
            {lead.follow_up_1_sent && !lead.follow_up_2_sent && (
              <button
                onClick={() => leadsApi.sendFollowUp(id, 2).then((r) => setLead(r.data))}
                className="btn-secondary flex items-center gap-2"
              >
                <Mail className="h-4 w-4" /> Send Follow-up 2 (Final)
              </button>
            )}
          </>
        ) : (
          <p className="text-slate-500 text-sm">No email address found for this lead. Add one to enable outreach.</p>
        )}
      </div>
    </div>
  );
}
