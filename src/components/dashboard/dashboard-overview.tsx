"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  DollarSign, 
  Clock, 
  Filter, 
  ArrowUpRight, 
  Loader2, 
  Calendar, 
  Sparkles, 
  TrendingUp, 
  TrendingDown 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Agent {
  id: string;
  fullName: string;
}

interface DashboardOverviewClientProps {
  initialAgents: Agent[];
}

interface MetricValue {
  value: number;
  change: number;
}

interface AvgResponseValue {
  valueMs: number;
  valueStr: string;
  change: number;
  isSlow: boolean;
}

interface FunnelItem {
  stageId: string;
  stageName: string;
  color: string;
  count: number;
}

interface SourceItem {
  source: string;
  count: number;
}

interface AgentPerformanceItem {
  agentId: string;
  agentName: string;
  avgResponseSeconds: number;
  avgResponseStr: string;
  replyCount: number;
}

interface StatsData {
  success: boolean;
  currentRange: { start: string; end: string };
  prevRange: { start: string; end: string };
  metrics: {
    totalLeads: MetricValue;
    estRevenue: MetricValue;
    avgResponse: AvgResponseValue;
  };
  funnel: FunnelItem[];
  sourceAttribution: SourceItem[];
  agentPerformance: AgentPerformanceItem[];
}

export function DashboardOverviewClient({ initialAgents }: DashboardOverviewClientProps) {
  const [agents] = useState<Agent[]>(initialAgents);
  
  // Filter States
  const [range, setRange] = useState<string>('month'); // today, month, year, custom
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default'); // default, count_desc, count_asc

  // Stats Data State
  const [loading, setLoading] = useState<boolean>(true);
  const [statsData, setStatsData] = useState<StatsData | null>(null);

  // Indonesian Date Formatting
  const getIndonesianDateStr = () => {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date());
  };

  // Format currency into readable IDR representation
  const formatIDR = (value: number) => {
    if (value >= 1_000_000_000) {
      return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
    }
    if (value >= 1_000_000) {
      return `Rp ${(value / 1_000_000).toFixed(1)} Juta`;
    }
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  };

  // Fetch stats from API
  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        let url = `/api/dashboard/stats?range=${range}&agentId=${selectedAgentId}&sortBy=${sortBy}`;
        if (range === 'custom' && startDate && endDate) {
          url += `&startDate=${startDate}&endDate=${endDate}`;
        }
        
        const res = await fetch(url);
        const data = await res.json();
        if (res.ok && data.success) {
          setStatsData(data);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }

    // Only trigger fetch if range is not custom OR if both dates are filled
    if (range !== 'custom' || (startDate && endDate)) {
      fetchStats();
    }
  }, [range, startDate, endDate, selectedAgentId, sortBy]);

  // Handle Sort By changes for lead funnel
  const getSortedFunnel = (): FunnelItem[] => {
    if (!statsData?.funnel) return [];
    const funnelCopy = [...statsData.funnel];
    if (sortBy === 'count_desc') {
      return funnelCopy.sort((a, b) => b.count - a.count);
    }
    if (sortBy === 'count_asc') {
      return funnelCopy.sort((a, b) => a.count - b.count);
    }
    return funnelCopy; // default (sorted by orderIndex from backend)
  };

  const sortedFunnel = getSortedFunnel();

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/40 p-4 md:p-6 lg:p-8">
      {/* Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/60 pb-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            Dashboard Monitoring
            <Sparkles className="w-5 h-5 text-primary" />
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-1">
            {getIndonesianDateStr()}
          </p>
        </div>

        {/* Filters Panel - Claymorphic styled selectors */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          {/* User/Agent Filter */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">Semua Agen</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.fullName}</option>
              ))}
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center gap-1.5 card-elevated px-4 py-2 text-xs text-slate-700">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent outline-none font-bold text-slate-700 cursor-pointer"
            >
              <option value="default">Urutan Alur Funnel</option>
              <option value="count_desc">Volume Tertinggi</option>
              <option value="count_asc">Volume Terendah</option>
            </select>
          </div>

          {/* Date Presets - Claymorphism style background pill */}
          <div className="flex bg-slate-200/50 p-1 rounded-2xl text-xs font-bold text-slate-600 shadow-inner w-full sm:w-auto justify-between sm:justify-start">
            <button
              onClick={() => setRange('today')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all ${
                range === 'today' ? "bg-white text-primary shadow-md scale-[1.02]" : "hover:text-slate-900"
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setRange('month')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all ${
                range === 'month' ? "bg-white text-primary shadow-md scale-[1.02]" : "hover:text-slate-900"
              }`}
            >
              Bulan
            </button>
            <button
              onClick={() => setRange('year')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all ${
                range === 'year' ? "bg-white text-primary shadow-md scale-[1.02]" : "hover:text-slate-900"
              }`}
            >
              Tahun
            </button>
            <button
              onClick={() => setRange('custom')}
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl transition-all ${
                range === 'custom' ? "bg-white text-primary shadow-md scale-[1.02]" : "hover:text-slate-900"
              }`}
            >
              Rentang
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Picker Inputs (displays only when range is custom) */}
      {range === 'custom' && (
        <div className="card-elevated p-5 mb-8 flex flex-col sm:flex-row gap-4 items-end animate-in slide-in-from-top-4 duration-200">
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" /> Tanggal Mulai
            </label>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full input-field px-4 py-2.5 text-xs text-slate-800 focus:outline-none"
            />
          </div>
          <div className="flex-1 w-full space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5" /> Tanggal Selesai
            </label>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full input-field px-4 py-2.5 text-xs text-slate-800 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Stats Loading Skeleton vs Data Cards */}
      {loading && !statsData ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-elevated p-6 flex flex-col gap-4 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-slate-200 rounded-xl"></div>
                <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
              </div>
              <div className="h-8 w-36 bg-slate-200 rounded-xl"></div>
              <div className="h-4 w-28 bg-slate-200 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Total Leads */}
          <Card className="card-elevated p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[150px] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#0d9488]/5 rounded-bl-full translate-x-4 -translate-y-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Total Leads</span>
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-2xl group-hover:scale-105 transition-transform shadow-inner">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-800 leading-none">
                {statsData?.metrics?.totalLeads?.value || 0}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                {(statsData?.metrics?.totalLeads?.change ?? 0) >= 0 ? (
                  <>
                    <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg gap-0.5 shadow-sm">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{statsData?.metrics?.totalLeads?.change}%
                    </span>
                    <span className="text-slate-400">vs periode lalu</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg gap-0.5 shadow-sm">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {statsData?.metrics?.totalLeads?.change}%
                    </span>
                    <span className="text-slate-400">vs periode lalu</span>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Card 2: Est. Revenue */}
          <Card className="card-elevated p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[150px] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full translate-x-4 -translate-y-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Est. Revenue</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-105 transition-transform shadow-inner">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-800 leading-none">
                {formatIDR(statsData?.metrics?.estRevenue?.value || 0)}
              </div>
              <div className="flex items-center gap-1.5 mt-3 text-xs font-bold">
                {(statsData?.metrics?.estRevenue?.change ?? 0) >= 0 ? (
                  <>
                    <span className="inline-flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg gap-0.5 shadow-sm">
                      <TrendingUp className="w-3.5 h-3.5" />
                      +{statsData?.metrics?.estRevenue?.change}%
                    </span>
                    <span className="text-slate-400">vs periode lalu</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg gap-0.5 shadow-sm">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {statsData?.metrics?.estRevenue?.change}%
                    </span>
                    <span className="text-slate-400">vs periode lalu</span>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Card 3: Avg Response Time */}
          <Card className="card-elevated p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between min-h-[150px] group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-full translate-x-4 -translate-y-4 transition-transform group-hover:scale-110"></div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">Avg Response</span>
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl group-hover:scale-105 transition-transform shadow-inner">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-extrabold text-slate-800 leading-none flex items-baseline gap-2.5">
                {statsData?.metrics?.avgResponse?.valueMs && statsData.metrics.avgResponse.valueMs > 0 
                  ? statsData.metrics.avgResponse.valueStr 
                  : "0m"}
                {statsData?.metrics?.avgResponse?.valueMs && statsData.metrics.avgResponse.valueMs > 0 && (
                  <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg uppercase shadow-sm ${
                    statsData.metrics.avgResponse.isSlow 
                      ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {statsData.metrics.avgResponse.isSlow ? 'Slow' : 'Fast'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-2">Waktu respon balasan pertama agen</p>
            </div>
          </Card>
        </div>
      )}

      {/* Funnel & Attribution Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead Funnel */}
        <Card className="lg:col-span-2 card-elevated p-6 flex flex-col justify-between">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Lead Funnel Stage
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="flex justify-between h-4 w-40 bg-slate-100 rounded"></div>
                    <div className="h-6 w-full bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : sortedFunnel.length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-400">
                Tidak ada data tahapan leads yang tersedia.
              </div>
            ) : (
              <div className="space-y-5">
                {sortedFunnel.map((item: FunnelItem) => {
                  const maxCount = Math.max(...statsData!.funnel.map((f: FunnelItem) => f.count), 1);
                  const percentage = (item.count / maxCount) * 100;
                  
                  return (
                    <div key={item.stageId} className="space-y-2">
                       <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700 flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full inline-block shrink-0 shadow-sm" 
                            style={{ backgroundColor: item.color || '#94a3b8' }}
                          ></span>
                          {item.stageName}
                        </span>
                        <span className="font-extrabold text-slate-800">{item.count}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-6 rounded-xl overflow-hidden flex shadow-inner">
                        <div 
                          className="h-full rounded-xl transition-all duration-500 shadow-sm hover:brightness-105"
                          style={{ 
                            width: `${percentage}%`, 
                            backgroundColor: item.color || '#94a3b8',
                            opacity: item.count > 0 ? 1 : 0.1
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Source Attribution */}
        <Card className="card-elevated p-6 flex flex-col">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-primary" />
              Source Attribution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : !statsData?.sourceAttribution || statsData.sourceAttribution.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-8 text-xs text-slate-400">
                Tidak ada data sumber leads.
              </div>
            ) : (
              <div className="space-y-4">
                {statsData.sourceAttribution.map((item: SourceItem) => {
                  const total = statsData!.sourceAttribution.reduce((acc: number, curr: SourceItem) => acc + curr.count, 0);
                  const pct = total > 0 ? ((item.count / total) * 100).toFixed(0) : "0";
                  
                  return (
                    <div key={item.source} className="border border-slate-100 p-4 rounded-2xl hover:bg-slate-50 transition-colors shadow-2xs">
                      <div className="flex justify-between items-center text-xs mb-2">
                        <span className="font-bold text-slate-700 capitalize">
                          {item.source.replace(/_/g, ' ')}
                        </span>
                        <span className="font-extrabold text-slate-800">{pct}% ({item.count})</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500 shadow-sm"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Response Speed KPI Leaderboard */}
      <div className="mt-8">
        <Card className="card-elevated p-6">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary animate-pulse" />
              Leaderboard Kecepatan Respon Agen
            </CardTitle>
            <p className="text-xs text-slate-400 font-semibold mt-1">Rata-rata kecepatan agen menjawab pesan masuk pertama dari pasien</p>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : !statsData?.agentPerformance || statsData.agentPerformance.length === 0 ? (
              <div className="text-center p-8 text-xs text-slate-400">
                Belum ada data performa agen untuk periode ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statsData.agentPerformance.map((agent: AgentPerformanceItem, index: number) => {
                  // Determine visual speed color indicator
                  let badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  let speedLabel = "Sangat Cepat";
                  if (agent.avgResponseSeconds > 15 * 60) {
                    badgeColor = "bg-rose-50 text-rose-700 border-rose-100";
                    speedLabel = "Lambat (>15m)";
                  } else if (agent.avgResponseSeconds > 5 * 60) {
                    badgeColor = "bg-amber-50 text-amber-700 border-amber-100";
                    speedLabel = "Sedang (>5m)";
                  }

                  return (
                    <div 
                      key={agent.agentId} 
                      className="border border-slate-100 p-4 rounded-2xl hover:bg-slate-50 transition-colors shadow-2xs flex flex-col justify-between gap-3 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-extrabold text-xs shadow-inner">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{agent.agentName}</h4>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{agent.replyCount} balasan terkirim</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-lg border shadow-sm ${badgeColor}`}>
                          {speedLabel}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline pt-1 border-t border-slate-50 mt-1">
                        <span className="text-[10px] text-slate-500 font-semibold">Rata-rata Respon:</span>
                        <span className="text-base font-extrabold text-slate-800 group-hover:text-primary transition-colors">
                          {agent.avgResponseStr}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

