import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import 'socket.io'; // Force Next.js to trace and include socket.io in standalone mode

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json({ error: 'contactId is required' }, { status: 400 });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          contactId: contactId
        }
      },
      orderBy: { sentAt: 'asc' },
      include: {
        sentBy: {
          select: { fullName: true }
        }
      }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { contactId, content, type = 'TEXT' } = body;

    if (!contactId || !content) {
      return NextResponse.json(
        { error: 'contactId and content are required' },
        { status: 400 }
      );
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Find or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { contactId, status: 'OPEN' },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          contactId,
          wahaSession: 'default',
        },
      });
    }

    const isInternalNote = type === 'NOTE';
    let wahaMessageId = null;

    // Jika bukan catatan internal, kirim ke WAHA
    if (!isInternalNote) {
      const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
      const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';

      // WAHA uses session parameter. We assume session 'default' for now.
      const chatId = contact.whatsappNumber.includes('@') ? contact.whatsappNumber : `${contact.whatsappNumber}@c.us`;
      const payload = {
        session: 'default',
        chatId: chatId,
        text: content,
      };

      const res = await fetch(`${WAHA_URL}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Api-Key': WAHA_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        console.error(`[WAHA] Failed to send message: ${res.statusText}`);
        return NextResponse.json(
          { error: 'Failed to send message via WAHA' },
          { status: 502 }
        );
      }

      const wahaResponse = await res.json();
      // Simpan ID WAHA jika dikembalikan untuk tracking status ACK nanti
      if (wahaResponse && wahaResponse.id) {
        wahaMessageId = typeof wahaResponse.id === 'object'
          ? (wahaResponse.id._serialized || wahaResponse.id.id)
          : wahaResponse.id;
      }
    }

    // Simpan ke database
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        content,
        type: isInternalNote ? 'INTERNAL_NOTE' : 'TEXT',
        direction: 'OUTBOUND',
        sentById: session.userId,
        isInternalNote,
        wahaMessageId,
        wahaStatus: isInternalNote ? null : 'SENT', // Internal note tidak butuh status WA
        sentAt: new Date(),
      },
      include: {
        sentBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    // Update conversation lastMessageAt and lastRepliedById
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { 
        lastMessageAt: new Date(),
        lastRepliedById: session.userId,
      },
    });

    // Update Contact lastInteraction
    await prisma.contact.update({
      where: { id: contactId },
      data: { lastInteractionAt: new Date(), totalMessages: { increment: 1 } },
    });

    // Socket.io emit to notify frontend in real-time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalIo = (global as any).__socketIO;
    if (globalIo) {
      // Emit to specific conversation room
      globalIo.to(`conversation:${conversation.id}`).emit('new_message', {
        conversationId: conversation.id,
        message: message,
        contact: contact
      });
      // Also emit globally for inbox list updates
      globalIo.emit('inbox_update', {
        contactId: contact.id,
        conversationId: conversation.id,
        lastMessage: message.content,
        lastMessageAt: message.sentAt,
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
