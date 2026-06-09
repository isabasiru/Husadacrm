import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS: Record<string, string> = {
  auto_followup_enabled: 'false',
  auto_followup_hours: '24',
  auto_followup_template: 'Halo {{nama}}, ada yang bisa kami bantu lagi untuk keluhan Anda? 😊',
};

// GET /api/settings
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };

    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({ success: true, settings: settingsMap });
  } catch (error) {
    console.error('Failed to get system settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

// POST /api/settings
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only admins or super admins should change settings
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid settings body' }, { status: 400 });
    }

    const upserts = Object.entries(body).map(([key, val]) => {
      const stringValue = typeof val === 'string' ? val : String(val);
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      });
    });

    await Promise.all(upserts);

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Failed to save system settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
