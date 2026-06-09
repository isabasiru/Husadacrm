/**
 * WAHA Helper — Send WhatsApp messages via WAHA API
 */

const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

/**
 * Normalize phone number to WhatsApp chat ID format
 * Accepts: "08123456789", "628123456789", "+628123456789"
 * Returns: "628123456789@c.us"
 */
export function normalizeToWaId(phone: string): string {
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  if (!clean.startsWith('62')) {
    clean = '62' + clean;
  }
  return `${clean}@c.us`;
}

/**
 * Send a text message via WAHA
 * @param to Phone number (any format) or WA ID (628xx@c.us)
 * @param text Message text
 */
export async function sendWahaMessage(to: string, text: string): Promise<boolean> {
  try {
    const chatId = to.includes('@') ? to : normalizeToWaId(to);

    const res = await fetch(`${WAHA_URL}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_KEY,
      },
      body: JSON.stringify({
        chatId,
        text,
        session: WAHA_SESSION,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[WAHA] Failed to send message:', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[WAHA] Error sending message:', err);
    return false;
  }
}

/**
 * Build assign notification message text
 */
export function buildAssignNotificationText(params: {
  assignedByName: string;
  contactName: string;
  contactPhone: string;
}): string {
  const { assignedByName, contactName, contactPhone } = params;
  return (
    `🔔 *Penugasan Baru*\n\n` +
    `Anda ditugaskan oleh *${assignedByName}* untuk menangani chat dengan:\n\n` +
    `👤 *${contactName || contactPhone}*\n` +
    `📱 ${contactPhone}\n\n` +
    `Silakan buka CRM Husada untuk melanjutkan percakapan. 🙏`
  );
}
