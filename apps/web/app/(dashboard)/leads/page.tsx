"use client";

import { useEffect, useState, useCallback } from "react";
import { leadsApi } from "@/lib/api";
import { Search, Mail, Download, RefreshCw, Plus, ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";

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

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-slate-100 text-slate-600",
  analyzed: "bg-blue-100 text-blue-700",
  contacted: "bg-purple-100 text-purple-700",
  replied: "bg-amber-100 text-amber-700",
  converted: "bg-green-100 text-green-700",
  ignored: "bg-slate-100 text-slate-400",
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">{total} total businesses discovered</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={() => setShowAnalyze(true)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> Analyze URL
          </button>
        </div>
      </div>

      {/* Analyze modal */}
      {showAnalyze && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-slate-900 mb-4">Analyze a Website</h3>
            <form onSubmit={analyzeUrl} className="space-y-3">
              <input className="input" placeholder="Business Name" value={analyzeForm.business_name}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, business_name: e.target.value })} required />
              <input className="input" placeholder="Website URL (https://...)" value={analyzeForm.website}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, website: e.target.value })} required />
              <input className="input" placeholder="City" value={analyzeForm.city}
                onChange={(e) => setAnalyzeForm({ ...analyzeForm, city: e.target.value })} />
              <input className="input" placeholder="Category (dentist, plumber...)" value={analyzeForm.category}
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
        <div className="flex items-center gap-2 flex-1 min-w-[160px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input className="input flex-1" placeholder="Filter by city..." value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)} />
        </div>
        <input className="input w-48" placeholder="Filter by category..." value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)} />
        <select className="input w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="analyzed">Analyzed</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="converted">Converted</option>
          <option value="ignored">Ignored</option>
        </select>
        <button onClick={fetchLeads} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Business</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Score</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Issues</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads found. Run the pipeline to discover businesses.</td></tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{lead.business_name}</div>
                      {lead.email && <div className="text-xs text-slate-400">{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lead.category || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.city || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${(lead.score || 0) <= 40 ? "text-red-600" : (lead.score || 0) <= 70 ? "text-amber-600" : "text-green-600"}`}>
                        {lead.score ?? "—"}/100
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">{lead.issues?.length ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[lead.status] || ""}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/leads/${lead.id}`} className="p-1.5 text-slate-400 hover:text-brand-600 rounded">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        {lead.email && !lead.email_sent && (
                          <button
                            onClick={() => sendEmail(lead)}
                            disabled={sendingId === lead.id}
                            className="p-1.5 text-slate-400 hover:text-purple-600 rounded"
                            title="Send outreach email"
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteLead(lead.id)}
                          disabled={deletingId === lead.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded"
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
