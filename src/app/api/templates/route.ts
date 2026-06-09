import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await prisma.messageTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

const extractVariables = (content: string): string[] => {
  const matches = content.match(/{{(.*?)}}/g);
  if (!matches) return [];
  // Return unique variables
  return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
};

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, content } = body;

    if (!name || !category || !content) {
      return NextResponse.json({ error: 'Name, category, and content are required' }, { status: 400 });
    }

    const variables = extractVariables(content);

    const template = await prisma.messageTemplate.create({
      data: {
        name,
        category,
        content,
        variables: { variables },
        createdById: session.userId
      }
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

