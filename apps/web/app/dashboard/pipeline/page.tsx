"use client";

import { useState, useEffect, useRef } from "react";
import { pipelineApi } from "@/lib/api";
import { Zap, Play, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";

interface PipelineRun {
  run_id: string;
  status: string;
  niche: string;
  city: string;
  total_discovered: number;
  total_analyzed: number;
  total_contacted: number;
  total_skipped: number;
  logs: string[];
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

export default function PipelinePage() {
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [numLeads, setNumLeads] = useState(20);
  const [sendEmails, setSendEmails] = useState(true);
  const [emailType, setEmailType] = useState("problem_loss");
  const [starting, setStarting] = useState(false);
  const [activeRun, setActiveRun] = useState<PipelineRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<PipelineRun[]>([]);
  const [showLogs, setShowLogs] = useState(true);
  const logsRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pipelineApi.listRuns()
      .then((res) => setRecentRuns(res.data))
      .catch(() => {});
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [activeRun?.logs]);

  // Poll the active run until it finishes
  useEffect(() => {
    if (!activeRun || activeRun.status !== "running") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await pipelineApi.getStatus(activeRun.run_id);
        setActiveRun(res.data);
        if (res.data.status !== "running") {
          clearInterval(pollRef.current!);
          setRecentRuns((prev) => [res.data, ...prev.filter((r) => r.run_id !== res.data.run_id)]);
        }
      } catch {
        clearInterval(pollRef.current!);
      }
    }, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeRun?.run_id, activeRun?.status]);

  const startPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !city.trim()) return;
    setStarting(true);
    try {
      const res = await pipelineApi.run({
        niche, city, num_leads: numLeads, send_emails: sendEmails, email_type: emailType,
      });
      setActiveRun(res.data);
      setShowLogs(true);
    } catch (err: unknown) {
      alert((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to start pipeline");
    } finally {
      setStarting(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "running") return <Loader2 className="h-4 w-4 text-accent animate-spin" />;
    if (status === "completed") return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    return <XCircle className="h-4 w-4 text-rose-400" />;
  };

  const nicheExamples = ["dentist", "plumber", "hair salon", "restaurant", "gym", "accountant"];

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-fg">Pipeline Runner</h1>
        <p className="text-muted mt-1">Discover, analyze, and contact local businesses automatically.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6">
            <h2 className="font-display font-semibold text-fg mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" /> Configure Run
            </h2>

            <form onSubmit={startPipeline} className="space-y-4">
              <div>
                <label className="label" htmlFor="pipeline-niche">Business Niche *</label>
                <input
                  id="pipeline-niche"
                  className="input"
                  placeholder="e.g. dentist"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  required
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {nicheExamples.map((ex) => (
                    <button key={ex} type="button" onClick={() => setNiche(ex)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-2 text-muted border border-edge transition-colors hover:text-accent hover:border-accent/40">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="pipeline-city">Location(s) *</label>
                <input
                  id="pipeline-city"
                  className="input"
                  placeholder="e.g. Manchester or delhi, mumbai, usa"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <p className="text-xs text-muted mt-1.5">Separate multiple locations with commas to scan them in one run.</p>
              </div>

              <div>
                <label className="label" htmlFor="pipeline-num-leads">
                  Leads to Discover: <span className="font-bold text-accent">{numLeads}</span>
                </label>
                <input id="pipeline-num-leads" type="range" min={5} max={50} step={5} value={numLeads}
                  onChange={(e) => setNumLeads(Number(e.target.value))}
                  className="w-full accent-[rgb(var(--accent))]" />
              </div>

              <div>
                <label className="label" htmlFor="pipeline-email-type">Email Template</label>
                <select id="pipeline-email-type" className="input" value={emailType} onChange={(e) => setEmailType(e.target.value)}>
                  <option value="problem_loss">Problem + Loss (recommended)</option>
                  <option value="value_first">Value First</option>
                  <option value="curiosity">Curiosity Based</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)}
                  className="rounded border-edge bg-base-2 text-accent focus:ring-accent/40" />
                <span className="text-sm text-fg">Send outreach emails automatically</span>
              </label>

              <button type="submit" disabled={starting || activeRun?.status === "running"}
                className="btn-primary w-full">
                {starting || activeRun?.status === "running"
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Running...</>
                  : <><Play className="h-4 w-4" /> Start Pipeline</>}
              </button>
            </form>
          </div>

          {/* Recent runs */}
          {recentRuns.length > 0 && (
            <div className="card p-4">
              <h3 className="font-medium text-fg text-sm mb-3">Recent Runs</h3>
              <div className="space-y-1">
                {recentRuns.slice(0, 5).map((run) => (
                  <button
                    key={run.run_id}
                    type="button"
                    className="w-full flex items-center justify-between p-2.5 rounded-xl transition-colors hover:bg-surface-2 text-left"
                    onClick={() => { setActiveRun(run); setShowLogs(true); }}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg truncate">{run.niche} in {run.city}</p>
                      <p className="text-xs text-muted">{run.total_contacted} contacted</p>
                    </div>
                    <StatusIcon status={run.status} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live log panel */}
        <div className="lg:col-span-2">
          {activeRun ? (
            <div className="card h-full flex flex-col overflow-hidden">
              {/* Run header */}
              <div className="p-5 border-b border-edge/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={activeRun.status} />
                  <div>
                    <p className="font-display font-semibold text-fg">{activeRun.niche} in {activeRun.city}</p>
                    <p className="text-xs text-muted">
                      {activeRun.city.includes(",")
                        ? `${activeRun.city.split(",").length} locations · Run ${activeRun.run_id.slice(0, 8)}`
                        : `Run ID: ${activeRun.run_id.slice(0, 8)}`}
                    </p>
                  </div>
                </div>
                <button type="button" title={showLogs ? "Hide logs" : "Show logs"} onClick={() => setShowLogs(!showLogs)} className="text-muted hover:text-fg transition-colors">
                  {showLogs ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 divide-x divide-edge/60 border-b border-edge/70">
                {[
                  { label: "Discovered", value: activeRun.total_discovered },
                  { label: "Analyzed", value: activeRun.total_analyzed },
                  { label: "Contacted", value: activeRun.total_contacted },
                  { label: "Skipped", value: activeRun.total_skipped },
                ].map(({ label, value }) => (
                  <div key={label} className="p-4 text-center">
                    <p className="font-display text-2xl font-bold text-fg">{value}</p>
                    <p className="text-xs text-muted mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Logs */}
              {showLogs && (
                <div
                  ref={logsRef}
                  className="flex-1 p-4 bg-[#070a12] font-mono text-xs text-emerald-400 overflow-y-auto max-h-96 rounded-b-xl"
                >
                  {activeRun.logs.length === 0
                    ? <span className="text-slate-500">Starting pipeline...</span>
                    : activeRun.logs.map((log, i) => (
                        <div key={i} className="mb-0.5 leading-relaxed">{log}</div>
                      ))}
                  {activeRun.status === "running" && (
                    <div className={clsx("flex items-center gap-2 mt-2", "text-accent")}>
                      <Loader2 className="h-3 w-3 animate-spin" /> Processing...
                    </div>
                  )}
                  {activeRun.error && (
                    <div className="mt-2 text-rose-400">ERROR: {activeRun.error}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="card h-full flex items-center justify-center p-12 text-center">
              <div>
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mb-4">
                  <Zap className="h-8 w-8 text-accent" />
                </div>
                <p className="font-medium text-fg">Configure a niche and location(s),</p>
                <p className="text-muted text-sm mt-0.5">then click Start Pipeline to begin.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
