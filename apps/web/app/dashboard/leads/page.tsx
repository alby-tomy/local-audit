"use client";

import { useEffect, useState, useCallback } from "react";
import { leadsApi } from "@/lib/api";
import { Search, Mail, Download, RefreshCw, Plus, ExternalLink, Trash2, X } from "lucide-react";
import Link from "next/link";
import { clsx } from "clsx";

interface Lead {
  id: string;
  business_name: string;
  category: string;
  city: string;
  website: string;
  email: string | null;
  score: number | null;
  priority: string | null;
  status: string;
  email_sent: boolean;
  replied: boolean;
  converted: boolean;
  issues: { code: string; title: string; severity: string }[];
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  discovered: "bg-surface-2 text-muted border border-edge",
  analyzed: "bg-sky-500/10 text-sky-400 border border-sky-500/25",
  contacted: "bg-violet-500/10 text-violet-400 border border-violet-500/25",
  replied: "bg-amber-500/10 text-amber-400 border border-amber-500/25",
  converted: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25",
  ignored: "bg-surface-2 text-muted/60 border border-edge",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Analyze single URL
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analyzeForm, setAnalyzeForm] = useState({ business_name: "", website: "", city: "", category: "" });
  const [analyzing, setAnalyzing] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cityFilter) params.city = cityFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await leadsApi.list(params);
      setLeads(res.data.leads);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [cityFilter, categoryFilter, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const sendEmail = async (lead: Lead) => {
    setSendingId(lead.id);
    try {
      await leadsApi.sendEmail(lead.id, { email_type: "problem_loss" });
      fetchLeads();
    } catch (e: unknown) {
      alert((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to send email");
    } finally {
      setSendingId(null);
    }
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    setDeletingId(id);
    try {
      await leadsApi.delete(id);
      fetchLeads();
    } finally {
      setDeletingId(null);
    }
  };

  const exportCsv = async () => {
    const res = await leadsApi.exportCsv();
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
  };

  const analyzeUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    try {
      await leadsApi.analyze(analyzeForm);
      setShowAnalyze(false);
      setAnalyzeForm({ business_name: "", website: "", city: "", category: "" });
      fetchLeads();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">Leads</h1>
          <p className="text-muted mt-1">{total} total businesses discovered</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="btn-secondary">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button type="button" onClick={() => setShowAnalyze(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Analyze URL
          </button>
        </div>
      </div>

      {/* Analyze modal */}
      {showAnalyze && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md relative animate-fade-up">
            <button
              type="button"
              onClick={() => setShowAnalyze(false)}
              title="Close"
              className="absolute top-4 right-4 text-muted hover:text-fg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="font-display font-semibold text-fg mb-4">Analyze a Website</h3>
            <form onSubmit={analyzeUrl} className="space-y-3">
              <input className="input" aria-label="Business Name" placeholder="Business Name" value={analyzeForm.business_name}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, business_name: e.target.value })} required />
              <input className="input" aria-label="Website URL" placeholder="Website URL (https://...)" value={analyzeForm.website}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, website: e.target.value })} required />
              <input className="input" aria-label="City" placeholder="City" value={analyzeForm.city}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, city: e.target.value })} />
              <input className="input" aria-label="Category" placeholder="Category (dentist, plumber...)" value={analyzeForm.category}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, category: e.target.value })} />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={analyzing}>
                  {analyzing ? "Analyzing..." : "Analyze"}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowAnalyze(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[160px] rounded-xl border border-edge bg-base-2/60 px-3.5 focus-within:ring-2 focus-within:ring-accent/40 focus-within:border-accent/60 transition-all">
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            className="flex-1 bg-transparent border-0 py-2.5 text-sm text-fg placeholder:text-muted/70 focus:outline-none focus:ring-0"
            aria-label="Filter by city"
            placeholder="Filter by city..." value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)} />
        </div>
        <input className="input w-48" aria-label="Filter by category" placeholder="Filter by category..." value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)} />
        <select className="input w-40" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="analyzed">Analyzed</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="converted">Converted</option>
          <option value="ignored">Ignored</option>
        </select>
        <button type="button" onClick={fetchLeads} title="Refresh" className="btn-secondary px-3">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge/70 bg-surface-2/40">
                <th className="text-left px-4 py-3 font-medium text-muted">Business</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted">City</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Score</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Issues</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/60">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No leads found. Run the pipeline to discover businesses.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="transition-colors hover:bg-surface-2/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-fg">{lead.business_name}</div>
                      {lead.email && <div className="text-xs text-muted">{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.category || "—"}</td>
                    <td className="px-4 py-3 text-muted">{lead.city || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        "font-bold font-display",
                        (lead.score ?? 0) <= 40 ? "text-rose-400" : (lead.score ?? 0) <= 70 ? "text-amber-400" : "text-emerald-400"
                      )}>
                        {lead.score ?? "—"}/100
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-fg">{lead.issues?.length ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", STATUS_STYLES[lead.status] || "")}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/leads/${lead.id}`} className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-accent/10 transition-colors">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        {lead.email && !lead.email_sent && (
                          <button
                            type="button"
                            onClick={() => sendEmail(lead)}
                            disabled={sendingId === lead.id}
                            className="p-1.5 text-muted hover:text-accent2 rounded-lg hover:bg-accent2/10 transition-colors disabled:opacity-50"
                            title="Send outreach email"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          disabled={deletingId === lead.id}
                          title="Delete lead"
                          className="p-1.5 text-muted hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
