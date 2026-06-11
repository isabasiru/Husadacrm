import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleChatbotFlow } from '@/lib/chatbot';
import { cleanTwilioPhone } from '@/lib/twilio';
import { WahaMessageStatus } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    console.log('[Twilio Webhook] Received payload:', Object.fromEntries(formData.entries()));

    const messageSid = formData.get('MessageSid') as string;
    const smsStatus = formData.get('SmsStatus') as string;
    const messageStatus = (formData.get('MessageStatus') as string) || smsStatus;

    // 1. Check if this is an outbound status callback
    const isStatusCallback = ['queued', 'sent', 'delivered', 'undelivered', 'failed', 'read'].includes(messageStatus) && messageStatus !== 'received';

    if (isStatusCallback) {
      console.log(`[Twilio Webhook] Status update for message ${messageSid}: ${messageStatus}`);
      let statusStr = 'SENT';
      if (messageStatus === 'delivered') statusStr = 'DELIVERED';
      if (messageStatus === 'read') statusStr = 'READ';
      if (messageStatus === 'failed' || messageStatus === 'undelivered') statusStr = 'FAILED';

      await prisma.message.updateMany({
        where: { wahaMessageId: messageSid },
        data: { wahaStatus: statusStr as WahaMessageStatus }
      });

      // Emit status update to frontend
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const globalIo = (global as any).__socketIO;
      if (globalIo) {
        const updatedMsg = await prisma.message.findUnique({
          where: { wahaMessageId: messageSid }
        });
        if (updatedMsg) {
          globalIo.to(`conversation:${updatedMsg.conversationId}`).emit('message_status_update', {
            messageId: updatedMsg.id,
            wahaMessageId: messageSid,
            wahaStatus: statusStr,
          });
        }
      }

      return new NextResponse('<Response></Response>', {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    // 2. Handle Inbound Message
    const fromTwilio = formData.get('From') as string; // e.g. "whatsapp:+628123456789"
    const toTwilio = formData.get('To') as string;     // e.g. "whatsapp:+14155238886"
    const body = formData.get('Body') as string || '';
    const profileName = formData.get('ProfileName') as string || null;

    if (!fromTwilio || !toTwilio) {
      return NextResponse.json({ error: 'Missing From or To parameter' }, { status: 400 });
    }

    const contactNumber = cleanTwilioPhone(fromTwilio);

    // Find or Create Contact
    let contact = await prisma.contact.findUnique({
      where: { whatsappNumber: contactNumber }
    });

    const isNewContact = !contact;

    if (!contact) {
      const defaultStage = await prisma.stage.findFirst({ where: { isDefault: true } });
      contact = await prisma.contact.create({
        data: {
          whatsappNumber: contactNumber,
          fullName: profileName,
          stageId: defaultStage?.id,
          source: 'whatsapp_webhook',
          chatbotState: null,
        }
      });
    }

    // Find or Create Conversation
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

    // Determine message type and media info
    let messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' = 'TEXT';
    const numMedia = parseInt(formData.get('NumMedia') as string || '0', 10);
    let mediaUrl = null;
    let mediaMimeType = null;

    if (numMedia > 0) {
      mediaUrl = formData.get('MediaUrl0') as string;
      mediaMimeType = formData.get('MediaContentType0') as string;
      
      if (mediaMimeType?.startsWith('image/')) {
        messageType = 'IMAGE';
      } else if (mediaMimeType?.startsWith('audio/') || mediaMimeType?.startsWith('video/')) {
        messageType = 'AUDIO';
      } else {
        messageType = 'DOCUMENT';
      }
    }

    // Save incoming message
    const savedMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        wahaMessageId: messageSid,
        direction: 'INBOUND',
        type: messageType,
        content: body,
        mediaUrl,
        mediaMimeType,
        wahaStatus: 'DELIVERED',
        sentAt: new Date(),
      }
    });

    // Update conversation & contact timestamps
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { 
        lastMessageAt: new Date(),
        lastRepliedById: null, // Reset lastRepliedById on incoming message
      }
    });

    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastInteractionAt: new Date(),
        totalMessages: { increment: 1 }
      }
    });

    // Chatbot flow
    let chatbotHandled = false;
    const chatbotSetting = await prisma.systemSetting.findUnique({
      where: { key: 'chatbot_enabled' }
    });
    const chatbotEnabled = chatbotSetting ? chatbotSetting.value === 'true' : true;

    const currentState = contact.chatbotState;
    if (chatbotEnabled && currentState !== 'done') {
      chatbotHandled = await handleChatbotFlow(
        contact.id,
        currentState,
        body,
        contactNumber
      );

      // Reload contact
      const refreshedContact = await prisma.contact.findUnique({
        where: { id: contact.id }
      });
      if (refreshedContact) contact = refreshedContact;
    }

    // Emit Socket.io events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const io = (global as any).__socketIO;
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

    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('[Twilio Webhook Error]:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
