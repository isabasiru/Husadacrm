'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  Award,
  Sparkles
} from 'lucide-react';

interface MetricDetail {
  value: number;
  change: number;
}

interface AvgResponseDetail {
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

interface MessageTrendItem {
  date: string;
  inbound: number;
  outbound: number;
}

interface StatsData {
  success: boolean;
  metrics: {
    totalLeads: MetricDetail;
    estRevenue: MetricDetail;
    avgResponse: AvgResponseDetail;
  };
  funnel: FunnelItem[];
  sourceAttribution: SourceItem[];
  messageTrends: MessageTrendItem[];
}

export default function AnalyticsPage() {
  const [range, setRange] = useState<'today' | 'month' | 'year'>('month');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/dashboard/stats?range=${range}`);
      if (!res.ok) {
        throw new Error('Gagal mengambil data statistik');
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
  }, [range]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(val);
  };

  const getTrendBadge = (change: number, reverse: boolean = false) => {
    const isPositive = change > 0;
    const isGood = reverse ? !isPositive : isPositive;
    const absChange = Math.abs(change);

    if (change === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/20">
          0%
        </span>
      );
    }

    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] font-extrabold px-2 py-0.5 rounded-full border ${
        isGood 
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      }`}>
        {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
        {absChange}%
      </span>
    );
  };

  // Render SVG Donut Chart for Leads Stage Distribution
  const renderStageDonut = (funnelData: FunnelItem[]) => {
    const total = funnelData.reduce((acc, curr) => acc + curr.count, 0);
    if (total === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-sm font-semibold text-muted-foreground">
          Tidak ada data prospek pada periode ini
        </div>
      );
    }

    let accumulatedPercentage = 0;
    const radius = 70;
    const strokeWidth = 18;
    const circumference = 2 * Math.PI * radius;
    const center = 100;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="relative w-48 h-48 shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
            {funnelData.map((item) => {
              if (item.count === 0) return null;
              const percentage = (item.count / total) * 100;
              const strokeLength = (percentage / 100) * circumference;
              const strokeOffset = circumference - strokeLength + (accumulatedPercentage / 100) * circumference;
              accumulatedPercentage += percentage;

              return (
                <circle
                  key={item.stageId}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  stroke={item.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out hover:opacity-85 cursor-pointer"
                >
                  <title>{`${item.stageName}: ${item.count} (${percentage.toFixed(1)}%)`}</title>
                </circle>
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-extrabold text-foreground">{total}</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Total Lead</span>
          </div>
        </div>

        <div className="flex-1 space-y-2.5 w-full">
          {funnelData.map((item) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.stageId} className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/10 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs font-bold text-foreground truncate max-w-[120px]">{item.stageName}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-xs font-extrabold text-foreground">{item.count}</span>
                  <span className="text-[10px] font-bold text-muted-foreground min-w-[45px]">{pct.toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render SVG Area/Line Chart for Message Trends
  const renderMessageTrends = (trends: MessageTrendItem[]) => {
    if (!trends || trends.length === 0) {
      return (
        <div className="h-72 flex items-center justify-center text-sm font-semibold text-muted-foreground">
          Belum ada aktivitas obrolan pada periode ini
        </div>
      );
    }

    const maxVal = Math.max(
      ...trends.map(t => Math.max(t.inbound, t.outbound)),
      10 // Fallback minimum scale
    );

    const padMax = Math.ceil(maxVal * 1.15); // Add padding to top of chart
    const width = 600;
    const height = 240;
    const paddingX = 40;
    const paddingY = 30;

    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;

    const pointsInbound: string[] = [];
    const pointsOutbound: string[] = [];

    const numPoints = trends.length;
    const getX = (index: number) => {
      if (numPoints <= 1) return paddingX + chartWidth / 2;
      return paddingX + (index / (numPoints - 1)) * chartWidth;
    };

    const getY = (val: number) => {
      return paddingY + chartHeight - (val / padMax) * chartHeight;
    };

    trends.forEach((item, idx) => {
      const x = getX(idx);
      const yIn = getY(item.inbound);
      const yOut = getY(item.outbound);

      pointsInbound.push(`${x},${yIn}`);
      pointsOutbound.push(`${x},${yOut}`);
    });

    const inboundPath = pointsInbound.length > 0 ? `M ${pointsInbound.join(' L ')}` : '';
    const outboundPath = pointsOutbound.length > 0 ? `M ${pointsOutbound.join(' L ')}` : '';

    // Closed paths for gradients
    const inboundAreaPath = pointsInbound.length > 0 
      ? `${inboundPath} L ${getX(numPoints - 1)},${height - paddingY} L ${getX(0)},${height - paddingY} Z`
      : '';
    const outboundAreaPath = pointsOutbound.length > 0 
      ? `${outboundPath} L ${getX(numPoints - 1)},${height - paddingY} L ${getX(0)},${height - paddingY} Z`
      : '';

    // Create 4 gridlines
    const yGridValues = [0, padMax * 0.33, padMax * 0.66, padMax];

    return (
      <div className="w-full">
        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines & Y Axis labels */}
          {yGridValues.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line 
                  x1={paddingX} 
                  y1={y} 
                  x2={width - paddingX} 
                  y2={y} 
                  stroke="currentColor" 
                  className="text-border/40" 
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text 
                  x={paddingX - 10} 
                  y={y + 4} 
                  textAnchor="end" 
                  className="fill-muted-foreground text-[10px] font-bold"
                >
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Fill Areas */}
          {inboundAreaPath && <path d={inboundAreaPath} fill="url(#inboundGrad)" />}
          {outboundAreaPath && <path d={outboundAreaPath} fill="url(#outboundGrad)" />}

          {/* Stroke Lines */}
          {inboundPath && (
            <path 
              d={inboundPath} 
              fill="none" 
              stroke="#10b981" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}
          {outboundPath && (
            <path 
              d={outboundPath} 
              fill="none" 
              stroke="#6366f1" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Dots on paths */}
          {trends.map((item, idx) => {
            const x = getX(idx);
            const yIn = getY(item.inbound);
            const yOut = getY(item.outbound);

            // Show dates on bottom axis (limit labels for readability)
            const showLabel = numPoints <= 7 || idx % Math.ceil(numPoints / 6) === 0 || idx === numPoints - 1;
            const parsedDate = new Date(item.date);
            const labelStr = parsedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

            return (
              <g key={idx}>
                {/* Dots */}
                <circle cx={x} cy={yIn} r="3" className="fill-emerald-500 stroke-background stroke-2" />
                <circle cx={x} cy={yOut} r="3" className="fill-indigo-500 stroke-background stroke-2" />

                {/* X labels */}
                {showLabel && (
                  <text 
                    x={x} 
                    y={height - paddingY + 18} 
                    textAnchor="middle" 
                    className="fill-muted-foreground text-[9px] font-bold"
                  >
                    {labelStr}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 bg-emerald-500 rounded-full inline-block" />
            <span className="text-[11px] font-extrabold text-foreground">Pesan Masuk (Inbound)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-1.5 bg-indigo-500 rounded-full inline-block" />
            <span className="text-[11px] font-extrabold text-foreground">Pesan Keluar (Outbound)</span>
          </div>
        </div>
      </div>
    );
  };

  // Render SVG Funnel Chart
  const renderFunnelChart = (funnelData: FunnelItem[]) => {
    const sortedFunnel = [...funnelData].sort((a, b) => b.count - a.count);
    const maxCount = sortedFunnel[0]?.count || 0;

    if (maxCount === 0) {
      return (
        <div className="h-64 flex items-center justify-center text-sm font-semibold text-muted-foreground">
          Belum ada data konversi corong penjualan
        </div>
      );
    }

    const width = 500;
    const rowHeight = 44;
    const gap = 8;
    const height = funnelData.length * (rowHeight + gap);

    return (
      <svg className="w-full" viewBox={`0 0 ${width} ${height}`}>
        {funnelData.map((item, idx) => {
          const count = item.count;
          const currentPct = maxCount > 0 ? count / maxCount : 0;
          
          // Calculate polygon coordinates for funnel block
          // Funnel width narrows down relative to stage order/count
          const shrinkFactor = 0.8;
          const topWidthFactor = idx === 0 ? 1 : 1 - (idx * 0.1 * shrinkFactor);
          const bottomWidthFactor = 1 - ((idx + 1) * 0.1 * shrinkFactor);
          
          const topWidth = width * topWidthFactor * currentPct;
          const bottomWidth = width * bottomWidthFactor * currentPct;

          const topX1 = (width - topWidth) / 2;
          const topX2 = topX1 + topWidth;
          const bottomX1 = (width - bottomWidth) / 2;
          const bottomX2 = bottomX1 + bottomWidth;

          const y1 = idx * (rowHeight + gap);
          const y2 = y1 + rowHeight;

          const points = `${topX1},${y1} ${topX2},${y1} ${bottomX2},${y2} ${bottomX1},${y2}`;

          return (
            <g key={item.stageId} className="group cursor-pointer">
              <polygon
                points={points}
                fill={item.color}
                opacity="0.85"
                className="transition-all duration-300 group-hover:opacity-100"
              />
              {/* Overlay values */}
              <text
                x={width / 2}
                y={y1 + rowHeight / 2 + 4}
                textAnchor="middle"
                className="fill-white text-[11px] font-extrabold select-none pointer-events-none"
              >
                {item.stageName}: {count} Pasien
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-[calc(100vh-2rem)] no-scrollbar">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Insight Bisnis Klinik</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Analitik Performa</h1>
          <p className="text-xs font-semibold text-muted-foreground mt-0.5">
            Analisis sebaran leads, konversi corong pasien, dan tren aktivitas WhatsApp secara real-time.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-1.5 bg-muted/40 border border-border/30 p-1.5 rounded-2xl self-start md:self-auto">
          <button
            onClick={() => setRange('today')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              range === 'today' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setRange('month')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              range === 'month' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bulan Ini
          </button>
          <button
            onClick={() => setRange('year')}
            className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
              range === 'year' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tahun Ini
          </button>
          <button 
            onClick={fetchStats}
            disabled={loading}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors ml-1 shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-3xl bg-muted/20 animate-pulse border border-border/10" />
          ))}
          <div className="md:col-span-2 h-80 rounded-3xl bg-muted/20 animate-pulse border border-border/10" />
          <div className="h-80 rounded-3xl bg-muted/20 animate-pulse border border-border/10" />
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-3xl p-6 text-center text-rose-500 max-w-md mx-auto my-8">
          <p className="text-sm font-extrabold mb-3">{error}</p>
          <button onClick={fetchStats} className="px-5 py-2 text-xs font-extrabold bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors">
            Coba Lagi
          </button>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Metrics summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Leads */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Total Prospek (Leads)</span>
                <span className="text-3xl font-black text-foreground block">{data.metrics.totalLeads.value}</span>
                <div className="flex items-center gap-1.5">
                  {getTrendBadge(data.metrics.totalLeads.change)}
                  <span className="text-[10px] text-muted-foreground font-semibold">vs periode lalu</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Estimated Revenue */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Estimasi Omzet (Revenue)</span>
                <span className="text-2xl font-black text-foreground block truncate max-w-[200px]" title={formatRupiah(data.metrics.estRevenue.value)}>
                  {formatRupiah(data.metrics.estRevenue.value)}
                </span>
                <div className="flex items-center gap-1.5">
                  {getTrendBadge(data.metrics.estRevenue.change)}
                  <span className="text-[10px] text-muted-foreground font-semibold">vs periode lalu</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Average Response Time */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl flex items-center justify-between group hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest block">Rata Waktu Respon Agen</span>
                <span className="text-3xl font-black text-foreground block">{data.metrics.avgResponse.valueStr}</span>
                <div className="flex items-center gap-1.5">
                  {getTrendBadge(data.metrics.avgResponse.change, true)}
                  <span className="text-[10px] text-muted-foreground font-semibold">vs periode lalu</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                data.metrics.avgResponse.isSlow 
                  ? 'bg-rose-500/10 text-rose-500' 
                  : 'bg-indigo-500/10 text-indigo-500'
              }`}>
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Row 2: Message Volume & Stage Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Message Volume trends (Line/Area Chart) */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-foreground">Aktivitas WhatsApp Harian</h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Grafik volume chat masuk & keluar secara harian.</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="py-2">
                {renderMessageTrends(data.messageTrends)}
              </div>
            </div>

            {/* Leads Stage Distribution */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-foreground">Sebaran Prospek</h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Komposisi sebaran pasien per tahap pipa penjualan.</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                {renderStageDonut(data.funnel)}
              </div>
            </div>
          </div>

          {/* Row 3: Conversion Funnel & Source Attribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Funnel chart */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-foreground">Corong Konversi Penjualan</h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Alur penurunan pasien dari prospek baru hingga sukses.</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-center py-4">
                <div className="w-full max-w-sm">
                  {renderFunnelChart(data.funnel)}
                </div>
              </div>
            </div>

            {/* Source Attribution */}
            <div className="card-elevated bg-sidebar border border-sidebar-border/40 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-foreground">Sumber Prospek (Attribution)</h3>
                  <p className="text-[10px] font-bold text-muted-foreground mt-0.5">Dari mana pasien mengetahui layanan klinik Anda.</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="space-y-4 py-2">
                {data.sourceAttribution.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                    Belum ada data atribusi sumber
                  </div>
                ) : (
                  data.sourceAttribution.map((item, idx) => {
                    const total = data.sourceAttribution.reduce((s, c) => s + c.count, 0);
                    const percent = total > 0 ? (item.count / total) * 100 : 0;
                    const colors = ['bg-primary', 'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                    const colorClass = colors[idx % colors.length];

                    return (
                      <div key={item.source} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-foreground capitalize">{item.source}</span>
                          <span className="font-semibold text-muted-foreground">
                            {item.count} Pasien ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
