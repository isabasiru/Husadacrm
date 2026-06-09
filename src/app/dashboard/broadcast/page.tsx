import prisma from '@/lib/prisma';
import { BroadcastClient } from '@/components/broadcast/broadcast-client';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage() {
  // Fetch required data for target filters
  const stages = await prisma.stage.findMany({
    orderBy: { orderIndex: 'asc' },
    select: { id: true, name: true }
  });

  const agents = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['AGENT', 'ADMIN', 'SUPER_ADMIN'] }
    },
    select: { id: true, fullName: true },
    orderBy: { fullName: 'asc' }
  });

  const totalContacts = await prisma.contact.count();

  return (
    <div className="flex-1 overflow-hidden flex flex-col h-full">
      <BroadcastClient 
        stages={stages} 
        agents={agents} 
        totalContacts={totalContacts} 
      />
    </div>
  );
}
