"use client";

import { useEffect, useState } from "react";
import { leadsApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Users, Mail, MessageSquare, TrendingUp, DollarSign, AlertCircle } from "lucide-react";

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

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#0ea5e9"];

export default function DashboardOverview() {
  const [stats, setStats] = useState<Stats>({ total: 0, emailed: 0, replied: 0, converted: 0, revenue: 0, high_priority: 0 });
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

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
    { name: "Critical (0-40)", value: recentLeads.filter((l) => l.score <= 40).length, color: "#ef4444" },
    { name: "Poor (41-60)", value: recentLeads.filter((l) => l.score > 40 && l.score <= 60).length, color: "#f59e0b" },
    { name: "Fair (61-70)", value: recentLeads.filter((l) => l.score > 60 && l.score <= 70).length, color: "#0ea5e9" },
    { name: "Good (71+)", value: recentLeads.filter((l) => l.score > 70).length, color: "#22c55e" },
  ];

  const funnelData = [
    { name: "Discovered", value: stats.total },
    { name: "Emailed", value: stats.emailed },
    { name: "Replied", value: stats.replied },
    { name: "Converted", value: stats.converted },
  ];

  const statCards = [
    { label: "Total Leads", value: stats.total, icon: Users, color: "text-brand-600", bg: "bg-brand-50" },
    { label: "Emails Sent", value: stats.emailed, icon: Mail, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Replies", value: stats.replied, icon: MessageSquare, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Conversions", value: stats.converted, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50" },
    { label: "Revenue", value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "High Priority", value: stats.high_priority, icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 mt-1">Your lead generation performance at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
              </div>
              <div className={`${bg} p-3 rounded-xl`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Lead Funnel</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Score Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={scoreDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value">
                {scoreDistribution.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent leads */}
      <div className="card">
        <div className="p-6 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Recent Leads</h3>
        </div>
        <div className="divide-y divide-slate-100">
          {recentLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No leads yet. Run a pipeline to discover businesses.
            </div>
          ) : (
            recentLeads.map((lead) => (
              <div key={lead.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{lead.business_name}</p>
                  <p className="text-sm text-slate-500">{lead.city}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${lead.score <= 40 ? "text-red-600" : lead.score <= 70 ? "text-amber-600" : "text-green-600"}`}>
                    {lead.score}/100
                  </span>
                  <span className={`badge-${lead.priority || "medium"}`}>{lead.priority || "medium"}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
