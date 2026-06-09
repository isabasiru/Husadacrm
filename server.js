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

      // Send via WAHA API
      const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
      const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
      const chatId = conv.contact.whatsappNumber.includes('@') ? conv.contact.whatsappNumber : `${conv.contact.whatsappNumber}@c.us`;

      let wahaMessageId = null;
      try {
        const res = await fetch(`${WAHA_URL}/api/sendText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Api-Key': WAHA_KEY,
          },
          body: JSON.stringify({
            session: 'default',
            chatId: chatId,
            text: formattedMessage,
          }),
        });

        if (!res.ok) {
          throw new Error(`WAHA API returned status: ${res.status} ${res.statusText}`);
        }

        const wahaResponse = await res.json();
        if (wahaResponse && wahaResponse.id) {
          wahaMessageId = typeof wahaResponse.id === 'object'
            ? (wahaResponse.id._serialized || wahaResponse.id.id)
            : wahaResponse.id;
        }
      } catch (err) {
        console.error(`[Auto Follow-Up] Failed to send WAHA message for contact ${conv.contact.id}:`, err);
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
    const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
    const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
    const WAHA_SESSION = process.env.WAHA_SESSION || 'default';
    
    const res = await fetch(`${WAHA_URL}/api/sessions/${WAHA_SESSION}`, {
      headers: { 'X-Api-Key': WAHA_KEY }
    });
    
    if (res.ok) {
      const data = await res.json();
      const currentStatus = data?.status || 'disconnected';
      const engineState = data?.engine?.state || 'DISCONNECTED';
      const isConnected = currentStatus === 'WORKING' && engineState === 'CONNECTED';
      const statusStr = isConnected ? 'CONNECTED' : (currentStatus === 'WORKING' ? 'SYNCING' : 'DISCONNECTED');
      
      if (statusStr !== lastKnownWahaStatus) {
        lastKnownWahaStatus = statusStr;
        console.log(`[WAHA Session Status Change] Status: ${statusStr}`);
        if (global.__socketIO) {
          global.__socketIO.emit('waha_session_status', { status: statusStr });
        }
      }
    } else {
      throw new Error(`WAHA status response: ${res.status}`);
    }
  } catch (err) {
    if (lastKnownWahaStatus !== 'DISCONNECTED') {
      lastKnownWahaStatus = 'DISCONNECTED';
      console.log(`[WAHA Session Status Change] Status: DISCONNECTED (Error: ${err.message})`);
      if (global.__socketIO) {
        global.__socketIO.emit('waha_session_status', { status: 'DISCONNECTED' });
      }
    }
  }
}


