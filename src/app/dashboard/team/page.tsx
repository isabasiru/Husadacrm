'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  DollarSign, 
  Shield, 
  RefreshCw,
  Award,
  Users
} from 'lucide-react';

interface AgentKpis {
  activeLeads: number;
  wonLeads: number;
  totalWonRevenue: number;
  replyCount: number;
  avgResponseSeconds: number | null;
  avgResponseStr: string;
}

interface AgentDetail {
  id: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  kpis: AgentKpis;
}

interface TeamData {
  success: boolean;
  agents: AgentDetail[];
}

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dashboard/team');
      if (!res.ok) {
        throw new Error('Gagal mengambil data performa tim');
      }
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Terjadi kesalahan sistem');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Koneksi gagal';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Helper to determine status: online within 1 hour
  const getStatusBadge = (lastLogin: string | null) => {
    if (!lastLogin) return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/20">Offline</span>;

    const loginDate = new Date(lastLogin);
    const diffMs = new Date().getTime() - loginDate.getTime();
    const isOnline = diffMs < 60 * 60 * 1000; // Logged in within 1 hour

    return isOnline ? (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/20">
        Aktif
      </span>
    );
  };

  // Get Top Performers
  const getTopResponder = (agents: AgentDetail[]) => {
    const activeResponders = agents.filter(a => a.kpis.avgResponseSeconds !== null && a.kpis.avgResponseSeconds > 0);
    if (activeResponders.length === 0) return null;
    return [...activeResponders].sort((a, b) => (a.kpis.avgResponseSeconds || 0) - (b.kpis.avgResponseSeconds || 0))[0];
  };

  const getTopSeller = (agents: AgentDetail[]) => {
    const sellers = agents.filter(a => a.kpis.totalWonRevenue > 0);
    if (sellers.length === 0) return null;
    return [...sellers].sort((a, b) => b.kpis.totalWonRevenue - a.kpis.totalWonRevenue)[0];
  };

  const totalWonRevenue = data?.agents.reduce((sum, a) => sum + a.kpis.totalWonRevenue, 0) || 0;
  const topResponder = data ? getTopResponder(data.agents) : null;
  const topSeller = data ? getTopSeller(data.agents) : null;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-2rem)] no-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Kolaborasi & Produktivitas</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Kinerja Tim & Agen</h1>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            Pantau responsivitas chat, total won deals, serta produktivitas per-agen secara detail.
          </p>
        </div>

        <button 
          onClick={fetchTeamData}
          disabled={loading}
          className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-4 py-2 rounded-xl text-xs font-extrabold transition-all self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-3xl bg-muted/20 border border-border/10" />
          ))}
          <div className="md:col-span-3 h-96 rounded-3xl bg-muted/20 border border-border/10" />
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 text-center text-rose-500 max-w-md mx-auto my-8">
          <p className="text-sm font-extrabold mb-3">{error}</p>
          <button onClick={fetchTeamData} className="px-5 py-2 text-xs font-extrabold bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors">
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Leaders board / Summary Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top Seller Card */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Top Sales Agent</span>
                <span className="text-lg font-black text-foreground block truncate max-w-[170px]">
                  {topSeller ? topSeller.fullName : 'Belum Ada'}
                </span>
                <span className="text-xs font-semibold text-emerald-500 block">
                  {topSeller ? formatRupiah(topSeller.kpis.totalWonRevenue) : 'Rp 0'} Won
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5" />
              </div>
            </div>

            {/* Top Responder Card */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Respon Tercepat</span>
                <span className="text-lg font-black text-foreground block truncate max-w-[170px]">
                  {topResponder ? topResponder.fullName : 'Belum Ada'}
                </span>
                <span className="text-xs font-semibold text-indigo-500 block">
                  Rata-rata {topResponder ? topResponder.kpis.avgResponseStr : '-'}
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* Total Won Revenue Card */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Total Omzet Sukses (Won)</span>
                <span className="text-xl font-black text-foreground block truncate max-w-[180px]" title={formatRupiah(totalWonRevenue)}>
                  {formatRupiah(totalWonRevenue)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground block">
                  Dari semua sales agen klinik
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Detailed Leaderboard Table */}
          <div className="card-elevated bg-sidebar border border-sidebar-border/40 rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-border/10 pb-4">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black text-foreground">Daftar Kinerja Individu</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/10">
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Nama & Jabatan</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-center">Status</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-center">Prospek Aktif</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-center">Deal Sukses (Won)</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-right">Nilai Won (Omzet)</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-center">Balasan Chat</th>
                    <th className="pb-3 text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider text-right">Kecepatan Respon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/5">
                  {data.agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-muted/10 transition-colors">
                      {/* Avatar & Name */}
                      <td className="py-4 pr-3">
                        <div className="flex items-center gap-3">
                          {agent.avatarUrl ? (
                            <img 
                              src={agent.avatarUrl} 
                              alt={agent.fullName} 
                              className="w-9 h-9 rounded-xl object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                              {getInitials(agent.fullName)}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-foreground text-xs block leading-tight">{agent.fullName}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5 block">
                              {agent.role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-3 text-center">
                        {getStatusBadge(agent.lastLoginAt)}
                      </td>

                      {/* Active Leads */}
                      <td className="py-4 px-3 text-center font-bold text-foreground text-xs">
                        {agent.kpis.activeLeads}
                      </td>

                      {/* Won Leads count */}
                      <td className="py-4 px-3 text-center font-bold text-foreground text-xs">
                        {agent.kpis.wonLeads}
                      </td>

                      {/* Won Revenue value */}
                      <td className="py-4 px-3 text-right font-extrabold text-emerald-500 text-xs">
                        {formatRupiah(agent.kpis.totalWonRevenue)}
                      </td>

                      {/* Balasan Chat Count */}
                      <td className="py-4 px-3 text-center font-semibold text-muted-foreground text-xs">
                        {agent.kpis.replyCount}
                      </td>

                      {/* Speed of Response */}
                      <td className="py-4 pl-3 text-right font-extrabold text-indigo-500 text-xs">
                        {agent.kpis.avgResponseStr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
