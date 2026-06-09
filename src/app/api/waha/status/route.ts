import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      
      return NextResponse.json({ status: statusStr });
    } else {
      return NextResponse.json({ status: 'DISCONNECTED' });
    }
  } catch (error) {
    console.error('[WAHA Status Endpoint Error]:', error);
    return NextResponse.json({ status: 'DISCONNECTED' });
  }
}
