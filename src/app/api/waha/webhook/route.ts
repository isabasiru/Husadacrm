import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleChatbotFlow } from '@/lib/chatbot';
// Socket.io is available via global.__socketIO from custom server.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const global: { __socketIO?: any } & typeof globalThis;

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('X-Api-Key');
    const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
    if (authHeader !== WAHA_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    console.log('Incoming Waha Webhook:', JSON.stringify(payload, null, 2));

    if (payload?.event === 'message') {
      const msg = payload.payload;
      if (!msg) return NextResponse.json({ success: true });

      // Clean the phone number
      let fromNumber = msg.from;
      if (fromNumber?.endsWith('@c.us')) fromNumber = fromNumber.split('@')[0];

      let toNumber = msg.to;
      if (toNumber?.endsWith('@c.us')) toNumber = toNumber.split('@')[0];

      const isFromMe = msg.fromMe;
      let contactNumber = isFromMe ? toNumber : fromNumber;

      if (!contactNumber) return NextResponse.json({ success: true });

      // Resolve LID format to phone number
      if (contactNumber.includes('@lid') || contactNumber.endsWith('lid')) {
        try {
          const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
          const lidClean = contactNumber.includes('@') ? contactNumber : `${contactNumber}@lid`;
          const res = await fetch(`${WAHA_URL}/api/default/lids/${lidClean}`, {
            headers: { 'X-Api-Key': WAHA_KEY, 'Accept': 'application/json' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.pn) {
              let resolvedNumber = data.pn;
              if (resolvedNumber.endsWith('@c.us')) resolvedNumber = resolvedNumber.split('@')[0];
              contactNumber = resolvedNumber;
            }
          }
        } catch (err) {
          console.error('[WAHA Webhook] Failed to resolve LID:', err);
        }
      }

      // 1. Find or Create Contact
      let contact = await prisma.contact.findUnique({
        where: { whatsappNumber: contactNumber }
      });

      const isNewContact = !contact;

      if (!contact) {
        const defaultStage = await prisma.stage.findFirst({ where: { isDefault: true } });
        contact = await prisma.contact.create({
          data: {
            whatsappNumber: contactNumber,
            fullName: msg._data?.notifyName || null,
            stageId: defaultStage?.id,
            source: 'whatsapp_webhook',
            chatbotState: null, // Will be set to 'ask_name' by chatbot
          }
        });
      }

      // 2. Find or Create Conversation
      let conversation = await prisma.conversation.findFirst({
        where: { contactId: contact.id, status: 'OPEN' }
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            contactId: contact.id,
            wahaSession: 'default',
          }
        });
      }

      // 3. Save incoming message
      const wahaType = msg.type || msg._data?.type || 'chat';
      let messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' = 'TEXT';
      if (wahaType === 'image') messageType = 'IMAGE';
      else if (wahaType === 'document') messageType = 'DOCUMENT';
      else if (wahaType === 'ptt' || wahaType === 'audio' || wahaType === 'voice') messageType = 'AUDIO';

      const savedMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          wahaMessageId: msg.id,
          direction: isFromMe ? 'OUTBOUND' : 'INBOUND',
          type: messageType,
          content: msg.body,
          wahaStatus: msg.ack ? 'DELIVERED' : 'SENT',
          sentAt: new Date(msg.timestamp * 1000),
        }
      });

      // Update conversation & contact timestamps
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });

      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastInteractionAt: new Date(),
          totalMessages: { increment: 1 }
        }
      });

      // 4. 🤖 Chatbot flow — only for INBOUND messages from non-done contacts
      let chatbotHandled = false;
      if (!isFromMe) {
        const chatbotSetting = await prisma.systemSetting.findUnique({
          where: { key: 'chatbot_enabled' }
        });
        const chatbotEnabled = chatbotSetting ? chatbotSetting.value === 'true' : true;

        const currentState = contact.chatbotState;
        if (chatbotEnabled && currentState !== 'done') {
          chatbotHandled = await handleChatbotFlow(
            contact.id,
            currentState,
            msg.body || '',
            contactNumber
          );

          // Reload contact after chatbot may have updated fields
          const refreshedContact = await prisma.contact.findUnique({
            where: { id: contact.id }
          });
          if (refreshedContact) contact = refreshedContact;
        }
      }

      // 5. Emit Socket.io events
      const io = global.__socketIO;
      if (io) {
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

        io.to(`conversation:${conversation.id}`).emit('new_message', {
          conversationId: conversation.id,
          message: savedMessage,
          contact: fullContact || contact,
        });
        io.emit('inbox_update', {
          contactId: contact.id,
          conversationId: conversation.id,
          lastMessage: savedMessage.content,
          lastMessageAt: savedMessage.sentAt,
          chatbotHandled,
          isNewContact,
          contact: fullContact,
        });
      }

    } else if (payload?.event === 'message.ack') {
      // Handle message status updates (Delivered, Read)
      const ackMsg = payload.payload;
      if (ackMsg?.id?.id) {
        let statusStr = 'SENT';
        if (ackMsg.ack === 2) statusStr = 'DELIVERED';
        if (ackMsg.ack === 3) statusStr = 'READ';

        await prisma.message.updateMany({
          where: { wahaMessageId: ackMsg.id._serialized || ackMsg.id.id },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { wahaStatus: statusStr as any }
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Waha webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
