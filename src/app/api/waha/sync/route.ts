import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contactId } = await request.json();
    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId }
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
    const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
    const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

    // Format chatId: e.g. 628xxx@c.us or resolve lid
    const num = contact.whatsappNumber;
    const chatId = num.includes('@') ? num : `${num}@c.us`;

    // Fetch last 50 messages from WAHA
    const wahaRes = await fetch(`${WAHA_URL}/api/messages?session=${WAHA_SESSION}&chatId=${chatId}&limit=50`, {
      headers: {
        'X-Api-Key': WAHA_KEY,
        'Accept': 'application/json'
      }
    });

    if (!wahaRes.ok) {
      const errText = await wahaRes.text();
      console.error('[WAHA Sync] Failed to fetch messages:', errText);
      return NextResponse.json({ error: 'Failed to fetch messages from WAHA' }, { status: 502 });
    }

    const wahaMessages = await wahaRes.json();
    if (!Array.isArray(wahaMessages)) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { contactId: contact.id, status: 'OPEN' }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId: contact.id,
          wahaSession: WAHA_SESSION,
        }
      });
    }

    let syncedCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any).__socketIO;

    // Process from oldest to newest
    const reversed = [...wahaMessages].reverse();

    for (const msg of reversed) {
      const wahaMessageId = msg.id;
      if (!wahaMessageId) continue;

      // Map ack to status
      let wahaStatus = 'SENT';
      if (msg.ack === 2) wahaStatus = 'DELIVERED';
      else if (msg.ack >= 3) wahaStatus = 'READ';

      // Map type
      const wahaType = msg.type || msg._data?.type || 'chat';
      let messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' = 'TEXT';
      if (wahaType === 'image') messageType = 'IMAGE';
      else if (wahaType === 'document') messageType = 'DOCUMENT';
      else if (wahaType === 'ptt' || wahaType === 'audio' || wahaType === 'voice') messageType = 'AUDIO';

      const sentAt = new Date(msg.timestamp * 1000);

      // Check if message already exists
      const existingMsg = await prisma.message.findUnique({
        where: { wahaMessageId }
      });

      if (existingMsg) {
        // Update status if it changed
        if (existingMsg.wahaStatus !== wahaStatus) {
          await prisma.message.update({
            where: { id: existingMsg.id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { wahaStatus: wahaStatus as any }
          });
        }
      } else {
        // Create new message
        const direction = msg.fromMe ? 'OUTBOUND' : 'INBOUND';
        const newMsg = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            wahaMessageId,
            direction,
            type: messageType,
            content: msg.body || '',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            wahaStatus: wahaStatus as any,
            sentAt,
          }
        });

        syncedCount++;

        // Notify client about new message
        if (io) {
          io.to(`conversation:${conversation.id}`).emit('new_message', {
            conversationId: conversation.id,
            message: newMsg,
            contact
          });
        }
      }
    }

    if (syncedCount > 0) {
      // Update timestamps
      const latestMsg = reversed[reversed.length - 1];
      const latestDate = latestMsg ? new Date(latestMsg.timestamp * 1000) : new Date();

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: latestDate }
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastInteractionAt: latestDate,
          totalMessages: { increment: syncedCount }
        }
      });

      // Update sidebar list for all agents
      if (io && latestMsg) {
        const fullContact = await prisma.contact.findUnique({
          where: { id: contact.id },
          include: {
            stage: true,
            tags: { include: { tag: true } },
            conversations: {
              orderBy: { lastMessageAt: 'desc' },
              take: 1,
              include: {
                lastRepliedBy: { select: { fullName: true } }
              }
            }
          }
        });

        io.emit('inbox_update', {
          contactId: contact.id,
          conversationId: conversation.id,
          lastMessage: latestMsg.body || '',
          lastMessageAt: latestDate,
          contact: fullContact,
        });
      }
    }

    return NextResponse.json({ success: true, syncedCount });
  } catch (error) {
    console.error('[WAHA Sync Endpoint Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
