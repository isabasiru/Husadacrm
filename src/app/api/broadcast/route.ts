import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

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

    const WAHA_URL = process.env.WAHA_API_URL;
    if (!WAHA_URL) {
      return NextResponse.json({ error: 'WAHA_API_URL is not configured' }, { status: 500 });
    }

    // Process broadcast asynchronously (fire and forget from client perspective)
    // In a production app with huge lists, use a queue (e.g. BullMQ or Inngest)
    // For now, we process in background
    processBroadcast(contacts, message, WAHA_URL, delayMs).catch(console.error);

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
async function processBroadcast(contacts: any[], message: string, wahaUrl: string, delayMs: number) {
  console.log(`[Broadcast] Starting for ${contacts.length} contacts...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const contact of contacts) {
    try {
      // WAHA uses session parameter. We assume session 'default' for now.
      const payload = {
        session: 'default',
        chatId: `${contact.whatsappNumber}@c.us`,
        text: message
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
      if (WAHA_KEY) {
        headers['X-Api-Key'] = WAHA_KEY;
      }

      const res = await fetch(`${wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
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
              sentAt: new Date(),
              isInternalNote: false,
              wahaStatus: 'SENT'
            }
          });
        }
      } else {
        console.error(`[Broadcast] Failed to send to ${contact.whatsappNumber}: ${res.statusText}`);
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
