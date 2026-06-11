import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch active agents
    const agents = await prisma.user.findMany({
      where: {
        role: {
          in: ['AGENT', 'ADMIN', 'SUPER_ADMIN']
        },
        isActive: true
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
        lastLoginAt: true
      },
      orderBy: { fullName: 'asc' }
    });

    // Fetch terminal stages to determine "Won" deals
    const terminalStages = await prisma.stage.findMany({
      where: { isTerminal: true },
      select: { id: true, name: true }
    });
    const terminalStageIds = terminalStages.map(s => s.id);

    // Gather KPIs for each agent
    const agentKpis = await Promise.all(agents.map(async (agent) => {
      // 1. Active Leads (assigned contacts not in terminal stages)
      const activeLeadsCount = await prisma.contact.count({
        where: {
          assignedAgentId: agent.id,
          OR: [
            { stageId: null },
            { 
              stage: {
                isTerminal: false
              }
            }
          ]
        }
      });

      // 2. Won Leads (assigned contacts in terminal stages)
      const wonLeadsCount = await prisma.contact.count({
        where: {
          assignedAgentId: agent.id,
          stageId: {
            in: terminalStageIds
          }
        }
      });

      // 3. Total Won Revenue (sum of custom field 'revenue' for won contacts)
      const wonContacts = await prisma.contact.findMany({
        where: {
          assignedAgentId: agent.id,
          stageId: {
            in: terminalStageIds
          }
        },
        select: { id: true }
      });
      const wonContactIds = wonContacts.map(c => c.id);

      const revenues = await prisma.contactCustomField.findMany({
        where: {
          contactId: {
            in: wonContactIds
          },
          fieldKey: 'revenue'
        },
        select: { fieldValue: true }
      });
      const totalWonRevenue = revenues.reduce((sum, r) => sum + (parseFloat(r.fieldValue) || 0), 0);

      // 4. Total Outbound Replies sent by this agent
      const replyCount = await prisma.message.count({
        where: {
          sentById: agent.id,
          direction: 'OUTBOUND'
        }
      });

      // 5. Avg Response Time for this agent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseResult = await prisma.$queryRaw<any[]>`
        SELECT 
          AVG(EXTRACT(EPOCH FROM (m.sent_at - prev.sent_at)))::double precision AS "avgResponseSeconds"
        FROM messages m
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
          AND m.sent_by_id = ${agent.id}::uuid
      `;

      const avgResponseSeconds = responseResult[0]?.avgResponseSeconds || null;

      const formatSecondsIndo = (totalSeconds: number | null) => {
        if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) return '-';
        const seconds = Math.round(totalSeconds);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
          return `${hours} jam ${minutes % 60} mnt`;
        }
        if (minutes > 0) {
          return `${minutes} menit`;
        }
        return `${seconds} detik`;
      };

      return {
        id: agent.id,
        fullName: agent.fullName,
        email: agent.email,
        role: agent.role,
        avatarUrl: agent.avatarUrl,
        lastLoginAt: agent.lastLoginAt,
        kpis: {
          activeLeads: activeLeadsCount,
          wonLeads: wonLeadsCount,
          totalWonRevenue,
          replyCount,
          avgResponseSeconds,
          avgResponseStr: formatSecondsIndo(avgResponseSeconds)
        }
      };
    }));

    return NextResponse.json({
      success: true,
      agents: agentKpis
    });
  } catch (error) {
    console.error('Error fetching team performance stats:', error);
    return NextResponse.json({ error: 'Failed to fetch team stats' }, { status: 500 });
  }
}
