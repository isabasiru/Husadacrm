import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sortBy') || 'date_desc';
    const agentId = searchParams.get('agentId') || 'all';
    const stageId = searchParams.get('stageId') || 'all';

    const whereClause: Prisma.ContactWhereInput = {};
    
    // Role-based restrictions (Agents only see their assigned contacts)
    if (session.role === 'AGENT') {
      whereClause.assignedAgentId = session.userId;
    } else if (agentId !== 'all') {
      whereClause.assignedAgentId = agentId;
    }

    if (stageId !== 'all') {
      whereClause.stageId = stageId;
    }

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      include: {
        stage: true,
        assignedAgent: true,
        customFields: true,
        conversations: {
          where: { status: 'OPEN' },
          take: 1,
          select: {
            lastRepliedBy: {
              select: { fullName: true }
            }
          }
        }
      }
    });

    // Apply sorting
    const sortedContacts = [...contacts];
    sortedContacts.sort((a, b) => {
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

    // Return the sorted list (limiting to 100 entries for endpoint performance)
    return NextResponse.json(sortedContacts.slice(0, 100));
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

