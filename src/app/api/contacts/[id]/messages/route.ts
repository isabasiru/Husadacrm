import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contactId } = await params;

    // Find the latest active conversation for this contact
    const conversation = await prisma.conversation.findFirst({
      where: { contactId },
      orderBy: { openedAt: 'desc' },
    });

    if (!conversation) {
      return NextResponse.json([]); // No conversation yet
    }

    // Ambil pesan dari yang terlama ke terbaru untuk flow chat
    const messages = await prisma.message.findMany({
      where: {
        conversationId: conversation.id,
      },
      orderBy: {
        sentAt: 'asc',
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

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
