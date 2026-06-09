import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

const extractVariables = (content: string): string[] => {
  const matches = content.match(/{{(.*?)}}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, category, content } = body;

    const existing = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (category !== undefined) data.category = category;
    if (content !== undefined) {
      data.content = content;
      data.variables = { variables: extractVariables(content) };
    }

    const updated = await prisma.messageTemplate.update({
      where: { id },
      data
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.messageTemplate.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.messageTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
