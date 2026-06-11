import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import 'socket.io'; // Force Next.js to trace and include socket.io in standalone mode
import { sendTwilioMessage } from '@/lib/twilio';

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

    // Jika bukan catatan internal, kirim ke Twilio
    if (!isInternalNote) {
      const twilioRes = await sendTwilioMessage(contact.whatsappNumber, content);

      if (!twilioRes.success) {
        console.error(`[Twilio] Failed to send message: ${twilioRes.error}`);
        return NextResponse.json(
          { error: twilioRes.error || 'Failed to send message via Twilio' },
          { status: 502 }
        );
      }

      wahaMessageId = twilioRes.sid || null;
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
      const fullContact = await prisma.contact.findUnique({
        where: { id: contactId },
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

      // Emit to specific conversation room
      globalIo.to(`conversation:${conversation.id}`).emit('new_message', {
        conversationId: conversation.id,
        message: message,
        contact: fullContact || contact
      });
      // Also emit globally for inbox list updates
      globalIo.emit('inbox_update', {
        contactId: contact.id,
        conversationId: conversation.id,
        lastMessage: message.content,
        lastMessageAt: message.sentAt,
        contact: fullContact,
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

export async function DELETE(request: Request) {
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

    // Fetch conversation of the contact
    const conversation = await prisma.conversation.findFirst({
      where: { contactId, status: 'OPEN' }
    });

    if (conversation) {
      // Delete all messages in this conversation
      await prisma.message.deleteMany({
        where: { conversationId: conversation.id }
      });
    }

    // Reset totalMessages counter and lastInteractionAt on contact
    await prisma.contact.update({
      where: { id: contactId },
      data: { totalMessages: 0, lastInteractionAt: null }
    });

    // Notify client via Socket.io
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalIo = (global as any).__socketIO;
    if (globalIo) {
      globalIo.emit('chat_cleared', { contactId, conversationId: conversation?.id });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing chat:', error);
    return NextResponse.json({ error: 'Failed to clear chat' }, { status: 500 });
  }
}
