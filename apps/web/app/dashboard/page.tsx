"use client";

import { useEffect, useState } from "react";
import { leadsApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, Mail, MessageSquare, TrendingUp, DollarSign, AlertCircle, ArrowUpRight } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { clsx } from "clsx";

interface Stats {
  total: number;
  emailed: number;
  replied: number;
  converted: number;
  revenue: number;
  high_priority: number;
}

interface Lead {
  id: string;
  business_name: string;
  city: string;
  score: number;
  priority: string;
  status: string;
  email_sent: boolean;
  replied: boolean;
  converted: boolean;
  deal_value: number | null;
  created_at: string;
}

const SEMANTIC = { rose: "#fb7185", amber: "#fbbf24", sky: "#38bdf8", emerald: "#34d399" };

// Tailwind's content scanner can't resolve `badge-${priority}` template literals —
// spelling out the literal class names here keeps .badge-high/.badge-medium in the build.
const BADGE_CLASS: Record<string, string> = {
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

/** Resolves the active theme's CSS variables to literal rgb() strings for recharts (SVG can't read Tailwind classes). */
function useThemeRGB() {
  const { theme } = useTheme();
  const [vars, setVars] = useState<Record<string, string>>({});

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    setVars({
      edge: read("--edge"),
      muted: read("--muted"),
      fg: read("--fg"),
      surface: read("--surface"),
      accent: read("--accent"),
      accent2: read("--accent-2"),
    });
  }, [theme]);

  return (key: string, alpha = 1) =>
    vars[key] ? `rgb(${vars[key]}${alpha < 1 ? ` / ${alpha}` : ""})` : "transparent";
}

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({ total: 0, emailed: 0, replied: 0, converted: 0, revenue: 0, high_priority: 0 });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const rgb = useThemeRGB();

  useEffect(() => {
    leadsApi.list({ limit: 200 }).then((res) => {
      const leads: Lead[] = res.data.leads;
      setRecentLeads(leads.slice(0, 5));
      setStats({
        total: res.data.total,
        emailed: leads.filter((l) => l.email_sent).length,
        replied: leads.filter((l) => l.replied).length,
        converted: leads.filter((l) => l.converted).length,
        revenue: leads.reduce((s, l) => s + (l.deal_value || 0), 0),
        high_priority: leads.filter((l) => l.priority === "high").length,
      });
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const scoreDistribution = [
    { name: "Critical (0-40)", value: recentLeads.filter((l) => l.score <= 40).length, color: SEMANTIC.rose },
    { name: "Poor (41-60)", value: recentLeads.filter((l) => l.score > 40 && l.score <= 60).length, color: SEMANTIC.amber },
    { name: "Fair (61-70)", value: recentLeads.filter((l) => l.score > 60 && l.score <= 70).length, color: SEMANTIC.sky },
    { name: "Good (71+)", value: recentLeads.filter((l) => l.score > 70).length, color: SEMANTIC.emerald },
  ];

  const funnelData = [
    { name: "Discovered", value: stats.total },
    { name: "Emailed", value: stats.emailed },
    { name: "Replied", value: stats.replied },
    { name: "Converted", value: stats.converted },
  ];

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: Users, accent: "accent" },
    { label: "Emails Sent", value: stats.emailed, icon: Mail, accent: "accent2" },
    { label: "Replies", value: stats.replied, icon: MessageSquare, accent: "accent" },
    { label: "Conversions", value: stats.converted, icon: TrendingUp, accent: "accent2" },
    { label: "Revenue", value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, accent: "accent" },
    { label: "High Priority", value: stats.high_priority, icon: AlertCircle, accent: "accent2" },
  ] as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-edge border-t-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-fg">Overview</h1>
        <p className="text-muted mt-1">Your lead generation performance at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, accent }, i) => (
          <div
            key={label}
            className="card card-hover p-5 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted">{label}</p>
                <p className="font-display text-2xl font-bold text-fg mt-1">{value}</p>
              </div>
              <div
                className={clsx(
                  "p-3 rounded-xl",
                  accent === "accent" ? "bg-accent/10" : "bg-accent2/10"
                )}
              >
                <Icon className={clsx("h-5 w-5", accent === "accent" ? "text-accent" : "text-accent2")} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-display font-semibold text-fg mb-4">Lead Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke={rgb("edge", 0.5)} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: rgb("muted") }} axisLine={{ stroke: rgb("edge") }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: rgb("muted") }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: rgb("surface-2", 0.5) }}
                contentStyle={{
                  background: rgb("surface", 0.95),
                  border: `1px solid ${rgb("edge")}`,
                  borderRadius: 12,
                  color: rgb("fg"),
                  fontSize: 13,
                }}
                labelStyle={{ color: rgb("fg") }}
              />
              <Bar dataKey="value" fill={rgb("accent")} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-display font-semibold text-fg mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={scoreDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke={rgb("surface")} strokeWidth={2}>
                {scoreDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: rgb("surface", 0.95),
                  border: `1px solid ${rgb("edge")}`,
                  borderRadius: 12,
                  color: rgb("fg"),
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: rgb("muted") }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-edge/70 flex items-center justify-between">
          <h3 className="font-display font-semibold text-fg">Recent Leads</h3>
          <a href="/dashboard/leads" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline underline-offset-4">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="divide-y divide-edge/60">
          {recentLeads.length === 0 ? (
            <div className="p-10 text-center text-muted">
              No leads yet. Run a pipeline to discover businesses.
            </div>
          ) : (
            recentLeads.map((lead) => (
              <div key={lead.id} className="px-6 py-4 flex items-center justify-between transition-colors hover:bg-surface-2/40">
                <div>
                  <p className="font-medium text-fg">{lead.business_name}</p>
                  <p className="text-sm text-muted">{lead.city}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={clsx(
                    "text-sm font-semibold font-display",
                    lead.score <= 40 ? "text-rose-400" : lead.score <= 70 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {lead.score}/100
                  </span>
                  <span className={BADGE_CLASS[lead.priority || "medium"] || BADGE_CLASS.medium}>{lead.priority || "medium"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
