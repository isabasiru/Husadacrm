import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTwilioConfig } from '@/lib/twilio';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await getTwilioConfig();
    const isConnected = !!(config.accountSid && config.authToken && config.whatsappNumber);
    
    return NextResponse.json({ status: isConnected ? 'CONNECTED' : 'DISCONNECTED' });
  } catch (error) {
    console.error('[Twilio Status Endpoint Error]:', error);
    return NextResponse.json({ status: 'DISCONNECTED' });
  }
}
