import prisma from '@/lib/prisma';
import { LeadsTableClient } from '@/components/leads/leads-table';
import { 
  startOfDay, 
  endOfDay, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  parseISO 
} from 'date-fns';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const sortBy = (params.sortBy as string) || 'date_desc';
  const agentId = (params.agentId as string) || 'all';
  const stageId = (params.stageId as string) || 'all';
  const range = (params.range as string) || 'all';
  const startDate = (params.startDate as string) || '';
  const endDate = (params.endDate as string) || '';

  // Construct database filter query
  const whereClause: Prisma.ContactWhereInput = {};

  if (agentId !== 'all') {
    whereClause.assignedAgentId = agentId;
  }

  if (stageId !== 'all') {
    whereClause.stageId = stageId;
  }

  // Parse date ranges
  if (range !== 'all') {
    let start = new Date();
    let end = new Date();
    const now = new Date();

    if (range === 'today') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (range === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else if (range === 'year') {
      start = startOfYear(now);
      end = endOfYear(now);
    } else if (range === 'custom' && startDate && endDate) {
      start = parseISO(startDate);
      end = endOfDay(parseISO(endDate));
    }

    if (range !== 'custom' || (startDate && endDate)) {
      whereClause.createdAt = {
        gte: start,
        lte: end,
      };
    }
  }

  // Fetch contacts with filters applied
  const contacts = await prisma.contact.findMany({
    where: whereClause,
    include: {
      stage: true,
      assignedAgent: true,
      tags: { include: { tag: true } },
      customFields: true,
    },
  });

  // Sort contacts in memory (custom fields sorting needs to be in-memory)
  const processedContacts = [...contacts];
  processedContacts.sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.fullName || '').localeCompare(b.fullName || '');
    }
    if (sortBy === 'name_desc') {
      return (b.fullName || '').localeCompare(a.fullName || '');
    }
    if (sortBy === 'revenue_desc' || sortBy === 'revenue_asc') {
      const aRev = a.customFields.find(f => f.fieldKey === 'revenue');
      const bRev = b.customFields.find(f => f.fieldKey === 'revenue');
      const valA = aRev ? parseFloat(aRev.fieldValue) || 0 : 0;
      const valB = bRev ? parseFloat(bRev.fieldValue) || 0 : 0;
      return sortBy === 'revenue_desc' ? valB - valA : valA - valB;
    }
    // Default: date_desc (updatedAt descending)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  // Fetch stages for the dropdown
  const stages = await prisma.stage.findMany({
    orderBy: { orderIndex: 'asc' },
    select: { id: true, name: true, color: true }
  });

  // Fetch agents for the dropdown (role AGENT or ADMIN)
  const agents = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] }
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' }
  });

  return (
    <div className="flex-1 overflow-hidden">
      <LeadsTableClient 
        initialContacts={processedContacts} 
        stages={stages} 
        agents={agents}
        currentSortBy={sortBy}
        currentAgentId={agentId}
        currentStageId={stageId}
        currentRange={range}
        currentStartDate={startDate}
        currentEndDate={endDate}
      />
    </div>
  );
}


