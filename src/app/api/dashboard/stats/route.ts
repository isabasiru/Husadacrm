import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  subYears, 
  parseISO 
} from 'date-fns';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'month'; // today, month, year, custom
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const agentId = searchParams.get('agentId') || 'all';

    // Parse date ranges
    let currentStart = new Date();
    let currentEnd = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    const now = new Date();

    if (range === 'today') {
      currentStart = startOfDay(now);
      currentEnd = endOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
    } else if (range === 'month') {
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
    } else if (range === 'year') {
      currentStart = startOfYear(now);
      currentEnd = endOfYear(now);
      prevStart = startOfYear(subYears(now, 1));
      prevEnd = endOfYear(subYears(now, 1));
    } else if (range === 'custom' && startDateParam && endDateParam) {
      currentStart = parseISO(startDateParam);
      currentEnd = parseISO(endDateParam);
      const diffMs = currentEnd.getTime() - currentStart.getTime();
      prevStart = new Date(currentStart.getTime() - diffMs - 1000);
      prevEnd = new Date(currentStart.getTime() - 1000);
    } else {
      // Default to current month
      currentStart = startOfMonth(now);
      currentEnd = endOfMonth(now);
      prevStart = startOfMonth(subMonths(now, 1));
      prevEnd = endOfMonth(subMonths(now, 1));
    }

    // Build common filters
    const currentFilter: Prisma.ContactWhereInput = {
      createdAt: {
        gte: currentStart,
        lte: currentEnd,
      }
    };

    const prevFilter: Prisma.ContactWhereInput = {
      createdAt: {
        gte: prevStart,
        lte: prevEnd,
      }
    };

    if (agentId !== 'all') {
      currentFilter.assignedAgentId = agentId;
      prevFilter.assignedAgentId = agentId;
    }

    // 1. Total Leads
    const currentLeadsCount = await prisma.contact.count({
      where: currentFilter
    });
    const prevLeadsCount = await prisma.contact.count({
      where: prevFilter
    });

    const leadsChange = prevLeadsCount > 0 
      ? parseFloat((((currentLeadsCount - prevLeadsCount) / prevLeadsCount) * 100).toFixed(1))
      : 0;

    // 2. Est. Revenue (custom field with key='revenue')
    const currentRevenues = await prisma.contactCustomField.findMany({
      where: {
        fieldKey: 'revenue',
        contact: currentFilter
      },
      select: { fieldValue: true }
    });

    const prevRevenues = await prisma.contactCustomField.findMany({
      where: {
        fieldKey: 'revenue',
        contact: prevFilter
      },
      select: { fieldValue: true }
    });

    const currentRevenueTotal = currentRevenues.reduce((acc, curr) => acc + (parseFloat(curr.fieldValue) || 0), 0);
    const prevRevenueTotal = prevRevenues.reduce((acc, curr) => acc + (parseFloat(curr.fieldValue) || 0), 0);

    const revenueChange = prevRevenueTotal > 0
      ? parseFloat((((currentRevenueTotal - prevRevenueTotal) / prevRevenueTotal) * 100).toFixed(1))
      : 0;

    // 3. Average Response Time
    // Computed based on conversations opened in this period, where firstResponseAt is not null
    const currentConvFilter: Prisma.ConversationWhereInput = {
      openedAt: {
        gte: currentStart,
        lte: currentEnd,
      },
      firstResponseAt: {
        not: null
      }
    };

    const prevConvFilter: Prisma.ConversationWhereInput = {
      openedAt: {
        gte: prevStart,
        lte: prevEnd,
      },
      firstResponseAt: {
        not: null
      }
    };

    if (agentId !== 'all') {
      currentConvFilter.assignedAgentId = agentId;
      prevConvFilter.assignedAgentId = agentId;
    }

    const currentConvs = await prisma.conversation.findMany({
      where: currentConvFilter,
      select: { openedAt: true, firstResponseAt: true }
    });

    const prevConvs = await prisma.conversation.findMany({
      where: prevConvFilter,
      select: { openedAt: true, firstResponseAt: true }
    });

    let currentAvgResponseMs = 0;
    if (currentConvs.length > 0) {
      const sum = currentConvs.reduce((acc, curr) => {
        const diff = curr.firstResponseAt!.getTime() - curr.openedAt.getTime();
        return acc + diff;
      }, 0);
      currentAvgResponseMs = sum / currentConvs.length;
    }

    let prevAvgResponseMs = 0;
    if (prevConvs.length > 0) {
      const sum = prevConvs.reduce((acc, curr) => {
        const diff = curr.firstResponseAt!.getTime() - curr.openedAt.getTime();
        return acc + diff;
      }, 0);
      prevAvgResponseMs = sum / prevConvs.length;
    }

    // Response time change trend percentage (lower is better, but we compute raw difference %)
    const responseChange = prevAvgResponseMs > 0
      ? parseFloat((((currentAvgResponseMs - prevAvgResponseMs) / prevAvgResponseMs) * 100).toFixed(1))
      : 0;

    // Format average response time as string
    const formatDuration = (ms: number) => {
      if (ms <= 0) return '0m';
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      }
      return `${minutes}m`;
    };

    const avgResponseStr = formatDuration(currentAvgResponseMs);
    const isSlow = currentAvgResponseMs > 15 * 60 * 1000; // Slow if avg response > 15 minutes

    // 4. Lead Funnel (Stage counts)
    const stages = await prisma.stage.findMany({
      orderBy: { orderIndex: 'asc' },
    });

    const funnelBreakdown = await Promise.all(stages.map(async (stage) => {
      const count = await prisma.contact.count({
        where: {
          ...currentFilter,
          stageId: stage.id,
        }
      });
      return {
        stageId: stage.id,
        stageName: stage.name,
        color: stage.color,
        count
      };
    }));

    // 5. Source Attribution (Sources breakdown)
    const sourcesGroup = await prisma.contact.groupBy({
      by: ['source'],
      where: currentFilter,
      _count: {
        _all: true
      }
    });

    const sourceAttribution = sourcesGroup.map(g => ({
      source: g.source || 'whatsapp',
      count: g._count._all
    }));

    // 6. Agent Response Time KPI Leaderboard
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const performanceResult = await prisma.$queryRaw<any[]>`
      SELECT 
        m.sent_by_id AS "agentId",
        u.full_name AS "agentName",
        AVG(EXTRACT(EPOCH FROM (m.sent_at - prev.sent_at)))::double precision AS "avgResponseSeconds",
        COUNT(m.id)::integer AS "replyCount"
      FROM messages m
      JOIN users u ON m.sent_by_id = u.id
      CROSS JOIN LATERAL (
        SELECT sent_at 
        FROM messages 
        WHERE conversation_id = m.conversation_id 
          AND direction = 'INBOUND' 
          AND sent_at < m.sent_at
        ORDER BY sent_at DESC
        LIMIT 1
      ) prev
      WHERE m.direction = 'OUTBOUND' 
        AND m.sent_by_id IS NOT NULL
        AND m.sent_at >= ${currentStart}
        AND m.sent_at <= ${currentEnd}
      GROUP BY m.sent_by_id, u.full_name
      ORDER BY "avgResponseSeconds" ASC
    `;

    const formatSecondsIndo = (totalSeconds: number | null) => {
      if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) return '0 menit';
      const seconds = Math.round(totalSeconds);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) {
        return `${days} hari ${hours % 24} jam`;
      }
      if (hours > 0) {
        return `${hours} jam ${minutes % 60} menit`;
      }
      if (minutes > 0) {
        return `${minutes} menit`;
      }
      return `${seconds} detik`;
    };

    const agentPerformance = performanceResult.map(r => ({
      agentId: r.agentId,
      agentName: r.agentName,
      avgResponseSeconds: r.avgResponseSeconds,
      avgResponseStr: formatSecondsIndo(r.avgResponseSeconds),
      replyCount: r.replyCount
    }));

    // 7. Message Volume Trends (Inbound vs Outbound messages)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageTrendsResult = await prisma.$queryRaw<any[]>`
      SELECT 
        DATE(sent_at) AS "date",
        COUNT(CASE WHEN direction = 'INBOUND' THEN 1 END)::integer AS "inbound",
        COUNT(CASE WHEN direction = 'OUTBOUND' THEN 1 END)::integer AS "outbound"
      FROM messages
      WHERE sent_at >= ${currentStart}
        AND sent_at <= ${currentEnd}
      GROUP BY DATE(sent_at)
      ORDER BY DATE(sent_at) ASC
    `;

    const messageTrends = messageTrendsResult.map(r => {
      let dateStr = '';
      if (r.date instanceof Date) {
        dateStr = r.date.toISOString().split('T')[0];
      } else if (typeof r.date === 'string') {
        dateStr = r.date.split('T')[0];
      } else {
        dateStr = String(r.date);
      }
      return {
        date: dateStr,
        inbound: r.inbound || 0,
        outbound: r.outbound || 0
      };
    });

    // Return all aggregated metrics
    return NextResponse.json({
      success: true,
      currentRange: {
        start: currentStart.toISOString(),
        end: currentEnd.toISOString()
      },
      prevRange: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString()
      },
      metrics: {
        totalLeads: {
          value: currentLeadsCount,
          change: leadsChange
        },
        estRevenue: {
          value: currentRevenueTotal,
          change: revenueChange
        },
        avgResponse: {
          valueMs: currentAvgResponseMs,
          valueStr: avgResponseStr,
          change: responseChange,
          isSlow
        }
      },
      funnel: funnelBreakdown,
      sourceAttribution,
      agentPerformance,
      messageTrends
    });
  } catch (error) {
    console.error('Error generating dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to generate statistics' }, { status: 500 });
  }
}
