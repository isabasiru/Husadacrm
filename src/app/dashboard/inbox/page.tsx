import prisma from '@/lib/prisma';
import { InboxClient } from '@/components/chat/inbox-client';
import { Metadata } from 'next';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Inbox - Husada CRM',
};

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const session = await getSession();
  let currentAgentName = "Agent";
  
  if (session?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { fullName: true }
    });
    if (user) {
      currentAgentName = user.fullName;
    }
  }

  // Ambil daftar kontak di sisi server untuk initial load dengan relasi lengkap
  const contactFilter = session?.role === 'AGENT' ? { assignedAgentId: session.userId } : {};
  const initialContacts = await prisma.contact.findMany({
    where: contactFilter,
    orderBy: { lastInteractionAt: 'desc' },
    include: {
      stage: true,
      tags: { include: { tag: true } },
      conversations: {
        where: { status: 'OPEN' },
        take: 1,
        include: {
          lastRepliedBy: {
            select: { fullName: true }
          }
        }
      }
    },
    take: 50, // Limit initial load for performance
  });

  // Ambil data stages untuk filter antrean
  const stages = await prisma.stage.findMany({
    orderBy: { orderIndex: 'asc' }
  });

  return (
    <div className="w-full h-full -m-4 md:-m-6 lg:-m-8">
      {/* We use negative margins to make the inbox take full width/height of the content area */}
      <InboxClient 
        initialContacts={initialContacts} 
        currentAgentName={currentAgentName}
        stages={stages}
        currentUser={{ id: session?.userId || "", role: session?.role || "AGENT" }}
      />
    </div>
  );
}
