import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendWahaMessage, buildAssignNotificationText } from '@/lib/waha';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;
    const body = await request.json();
    const { agentId } = body; // Target agent to assign to

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    // Check if contact exists
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Check if target agent exists
    const targetAgent = await prisma.user.findUnique({
      where: { id: agentId },
    });

    if (!targetAgent) {
      return NextResponse.json({ error: 'Target agent not found' }, { status: 404 });
    }

    const oldAgentId = contact.assignedAgentId;

    // Use Prisma transaction to ensure all updates and logs succeed together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update contact's assigned agent
      const updatedContact = await tx.contact.update({
        where: { id: contactId },
        data: { assignedAgentId: agentId },
        include: {
          stage: true,
          tags: { include: { tag: true } }
        }
      });

      // 2. Update all OPEN conversations for this contact to the new agent
      await tx.conversation.updateMany({
        where: { contactId, status: 'OPEN' },
        data: { assignedAgentId: agentId },
      });

      // 3. Create AssignHistory log
      const assignHistory = await tx.assignHistory.create({
        data: {
          contactId,
          fromAgentId: oldAgentId,
          toAgentId: agentId,
          assignedById: session.userId,
        },
        include: {
          toAgent: {
            select: { fullName: true, whatsappNumber: true }
          },
          assignedBy: {
            select: { fullName: true }
          }
        }
      });

      return { updatedContact, assignHistory };
    });

    // Notify clients real-time using Socket.io
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalIo = (global as any).__socketIO;
    if (globalIo) {
      globalIo.emit('contact_assigned', {
        contactId,
        fromAgentId: oldAgentId,
        toAgentId: agentId,
        assignedBy: result.assignHistory.assignedBy?.fullName || 'System',
        assignedTo: result.assignHistory.toAgent.fullName,
        contact: result.updatedContact,
      });
    }

    // 🔔 Send WhatsApp notification to the assigned agent (fire-and-forget)
    const assignedToWa = result.assignHistory.toAgent.whatsappNumber;
    if (assignedToWa) {
      const assignerName = result.assignHistory.assignedBy?.fullName || 'Tim Husada';
      const notifText = buildAssignNotificationText({
        assignedByName: assignerName,
        contactName: contact.fullName || '',
        contactPhone: contact.whatsappNumber,
      });
      // Non-blocking — don't await, failure won't break assign
      sendWahaMessage(assignedToWa, notifText).catch((err) =>
        console.error('[Assign Notif] Failed to send WA:', err)
      );
    }

    return NextResponse.json({
      success: true,
      contact: result.updatedContact,
      history: result.assignHistory,
    });
  } catch (error) {
    console.error('Error assigning contact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
