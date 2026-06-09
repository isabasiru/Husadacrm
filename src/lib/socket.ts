import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(httpServer, {
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

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join a room based on agentId for targeted notifications
    socket.on('join_agent_room', (agentId: string) => {
      socket.join(`agent:${agentId}`);
      console.log(`[Socket.io] ${socket.id} joined room agent:${agentId}`);
    });

    // Join a room for a specific conversation
    socket.on('join_conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket.io] ${socket.id} joined room conversation:${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[Socket.io] Server initialized on path /api/socketio');
  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
