const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.io
  const io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',') 
        : ['https://husada.webhaus.id', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Store io instance globally so API routes can access it
  global.__socketIO = io;

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('join_agent_room', (agentId) => {
      socket.join(`agent:${agentId}`);
      console.log(`[Socket.io] ${socket.id} joined agent:${agentId}`);
    });

    socket.on('join_conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket.io] ${socket.id} joined conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Disconnected: ${socket.id} (${reason})`);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Husada CRM ready on http://${hostname}:${port}`);
    console.log(`> Socket.io ready on /api/socketio`);

    // Start background auto follow-up interval
    setInterval(runAutoFollowUp, 30 * 60 * 1000); // Runs every 30 minutes
    // Run once 1 minute after boot to process any pending items
    setTimeout(runAutoFollowUp, 60 * 1000);

    // Start background WAHA status check (runs every 15s, and first check after 2s)
    setInterval(checkWahaSessionStatus, 15000);
    setTimeout(checkWahaSessionStatus, 2000);
  });
});

async function runAutoFollowUp() {
  try {
    console.log('[Auto Follow-Up] Checking for idle conversations...');
    
    // 1. Get enabled setting
    const enabledSetting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_followup_enabled' }
    });
    
    if (!enabledSetting || enabledSetting.value !== 'true') {
      console.log('[Auto Follow-Up] Feature disabled.');
      return;
    }

    // 2. Get wait hours setting
    const hoursSetting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_followup_hours' }
    });
    const waitHours = hoursSetting ? parseInt(hoursSetting.value) || 24 : 24;

    // 3. Get custom message template setting
    const templateSetting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_followup_template' }
    });
    const templateStr = templateSetting ? templateSetting.value : 'Halo {{nama}}, ada yang bisa kami bantu lagi? 😊';

    const thresholdTime = new Date(Date.now() - waitHours * 60 * 60 * 1000);
    const systemUserId = 'de5118a9-d0d0-4d14-9670-13e3e56b5116';

    // 4. Find open conversations where lastMessageAt is older than threshold
    const idleConversations = await prisma.conversation.findMany({
      where: {
        status: 'OPEN',
        lastMessageAt: {
          lt: thresholdTime
        }
      },
      include: {
        contact: true,
        messages: {
          orderBy: { sentAt: 'desc' },
          take: 1
        }
      }
    });

    console.log(`[Auto Follow-Up] Found ${idleConversations.length} total idle open conversations.`);

    for (const conv of idleConversations) {
      const lastMsg = conv.messages[0];
      if (!lastMsg || lastMsg.direction !== 'OUTBOUND') {
        // Last message wasn't outbound (meaning client spoke last, which needs agent reply)
        continue;
      }

      if (lastMsg.sentById === systemUserId) {
        // Already followed up by system, skip to avoid spamming
        continue;
      }

      // Format custom message: replace {{nama}} with contact's full name or fallback
      const name = conv.contact.fullName || 'Kak';
      const formattedMessage = templateStr.replace(/\{\{nama\}\}/g, name);

      console.log(`[Auto Follow-Up] Sending follow-up to contact ${conv.contact.fullName} (${conv.contact.whatsappNumber})...`);

      // Send via Twilio JS Helper
      let wahaMessageId = null;
      try {
        const twilioRes = await sendTwilioMessageJs(conv.contact.whatsappNumber, formattedMessage);
        if (!twilioRes.success) {
          throw new Error(twilioRes.error || 'Failed to send message via Twilio');
        }
        wahaMessageId = twilioRes.sid;
      } catch (err) {
        console.error(`[Auto Follow-Up] Failed to send Twilio message for contact ${conv.contact.id}:`, err.message);
        continue; // skip database updates for this failure
      }

      // Save follow-up message to database
      const message = await prisma.message.create({
        data: {
          conversationId: conv.id,
          content: formattedMessage,
          type: 'TEXT',
          direction: 'OUTBOUND',
          sentById: systemUserId,
          isInternalNote: false,
          wahaMessageId,
          wahaStatus: 'SENT',
          sentAt: new Date(),
        }
      });

      // Update conversation
      await prisma.conversation.update({
        where: { id: conv.id },
        data: { 
          lastMessageAt: new Date(),
          lastRepliedById: systemUserId,
        },
      });

      // Update Contact lastInteractionAt
      await prisma.contact.update({
        where: { id: conv.contact.id },
        data: { 
          lastInteractionAt: new Date(),
          totalMessages: { increment: 1 }
        },
      });

      // Log in ActivityLog for Hermes agents auditing
      await prisma.activityLog.create({
        data: {
          userId: systemUserId,
          action: 'auto_followup',
          entityType: 'conversation',
          entityId: conv.id,
          metadata: {
            contactId: conv.contact.id,
            contactName: conv.contact.fullName,
            contactPhone: conv.contact.whatsappNumber,
            messageId: message.id,
            hoursWaited: waitHours,
          }
        }
      });

      // Emit Socket.io events
      if (global.__socketIO) {
        const fullContact = await prisma.contact.findUnique({
          where: { id: conv.contact.id },
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

        global.__socketIO.to(`conversation:${conv.id}`).emit('new_message', {
          conversationId: conv.id,
          message: message,
          contact: fullContact || conv.contact
        });

        global.__socketIO.emit('inbox_update', {
          contactId: conv.contact.id,
          conversationId: conv.id,
          lastMessage: message.content,
          lastMessageAt: message.sentAt,
          senderName: 'System',
          contact: fullContact,
        });
      }

      console.log(`[Auto Follow-Up] Follow-up sent and logged successfully for conversation ${conv.id}.`);
    }
  } catch (err) {
    console.error('[Auto Follow-Up] Error in background task:', err);
  }
}

let lastKnownWahaStatus = null;
async function checkWahaSessionStatus() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number']
        }
      }
    });

    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });

    const isConnected = !!(
      (config.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID) &&
      (config.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN) &&
      (config.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER)
    );

    const statusStr = isConnected ? 'CONNECTED' : 'DISCONNECTED';
    
    if (statusStr !== lastKnownWahaStatus) {
      lastKnownWahaStatus = statusStr;
      console.log(`[Twilio Session Status Change] Status: ${statusStr}`);
      if (global.__socketIO) {
        global.__socketIO.emit('waha_session_status', { status: statusStr });
      }
    }
  } catch (err) {
    if (lastKnownWahaStatus !== 'DISCONNECTED') {
      lastKnownWahaStatus = 'DISCONNECTED';
      console.log(`[Twilio Status Check Error]: DISCONNECTED (Error: ${err.message})`);
      if (global.__socketIO) {
        global.__socketIO.emit('waha_session_status', { status: 'DISCONNECTED' });
      }
    }
  }
}

async function sendTwilioMessageJs(to, text) {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number']
        }
      }
    });

    const config = {};
    settings.forEach(s => {
      config[s.key] = s.value;
    });

    const accountSid = config.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID;
    const authToken = config.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN;
    const whatsappNumber = config.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !whatsappNumber) {
      return { success: false, error: 'Twilio settings not fully configured in system_settings' };
    }

    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    let cleanTo = to.replace(/\D/g, '');
    if (cleanTo.startsWith('0')) {
      cleanTo = '62' + cleanTo.slice(1);
    }
    const toFormatted = `whatsapp:+${cleanTo}`;

    let cleanFrom = whatsappNumber.replace(/\D/g, '');
    if (cleanFrom.startsWith('0')) {
      cleanFrom = '62' + cleanFrom.slice(1);
    }
    const fromFormatted = `whatsapp:+${cleanFrom}`;

    const message = await client.messages.create({
      from: fromFormatted,
      to: toFormatted,
      body: text
    });

    return { success: true, sid: message.sid, status: message.status };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


