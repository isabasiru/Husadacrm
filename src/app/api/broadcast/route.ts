import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { sendTwilioMessage, getTwilioConfig } from '@/lib/twilio';

// Sleep helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetValue, message, delayMs = 3000 } = body;

    if (!message || message.trim() === '') {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    let contacts = [];

    // Fetch contacts based on target
    if (targetType === 'all') {
      contacts = await prisma.contact.findMany();
    } else if (targetType === 'stage' && targetValue) {
      contacts = await prisma.contact.findMany({ where: { stageId: targetValue } });
    } else if (targetType === 'agent' && targetValue) {
      contacts = await prisma.contact.findMany({ where: { assignedAgentId: targetValue } });
    } else {
      return NextResponse.json({ error: 'Invalid target configuration' }, { status: 400 });
    }

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts found for the selected target' }, { status: 404 });
    }

    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken || !config.whatsappNumber) {
      return NextResponse.json({ error: 'Twilio is not configured in settings.' }, { status: 500 });
    }

    // Process broadcast asynchronously (fire and forget from client perspective)
    // In a production app with huge lists, use a queue (e.g. BullMQ or Inngest)
    // For now, we process in background
    processBroadcast(contacts, message, delayMs).catch(console.error);

    return NextResponse.json({
      success: true,
      message: `Broadcast started for ${contacts.length} contacts.`,
      recipientCount: contacts.length
    });

  } catch (error) {
    console.error('Broadcast error:', error);
    return NextResponse.json({ error: 'Failed to process broadcast' }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBroadcast(contacts: any[], message: string, delayMs: number) {
  console.log(`[Broadcast] Starting for ${contacts.length} contacts...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const contact of contacts) {
    try {
      const res = await sendTwilioMessage(contact.whatsappNumber, message);

      if (res.success) {
        successCount++;
        // Log to db (optional: create message record)
        const conversation = await prisma.conversation.findFirst({
          where: { contactId: contact.id },
          orderBy: { lastMessageAt: 'desc' }
        });

        if (conversation) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: 'OUTBOUND',
              type: 'TEXT',
              content: message,
              wahaMessageId: res.sid,
              sentAt: new Date(),
              isInternalNote: false,
              wahaStatus: 'SENT'
            }
          });
        }
      } else {
        console.error(`[Broadcast] Failed to send to ${contact.whatsappNumber}: ${res.error}`);
        failCount++;
      }
    } catch (err) {
      console.error(`[Broadcast] Error sending to ${contact.whatsappNumber}:`, err);
      failCount++;
    }

    // Delay between messages to prevent spam blocking
    if (delayMs > 0) {
      await delay(delayMs);
    }
  }

  console.log(`[Broadcast] Finished. Success: ${successCount}, Failed: ${failCount}`);
  
  // Log the broadcast event
  await prisma.activityLog.create({
    data: {
      action: 'BROADCAST_COMPLETED',
      entityType: 'broadcast',
      metadata: {
        successCount,
        failCount,
        totalAttempted: contacts.length,
        messagePreview: message.substring(0, 50)
      }
    }
  });
}
