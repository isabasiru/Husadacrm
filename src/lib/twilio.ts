import twilio from 'twilio';
import prisma from './prisma';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  whatsappNumber: string;
}

/**
 * Fetch Twilio credentials from system settings database
 */
export async function getTwilioConfig(): Promise<TwilioConfig> {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ['twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_number'],
      },
    },
  });

  const config: Record<string, string> = {};
  settings.forEach((s) => {
    config[s.key] = s.value;
  });

  return {
    accountSid: config.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID || '',
    authToken: config.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN || '',
    whatsappNumber: config.twilio_whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER || '',
  };
}

/**
 * Normalize phone number to Twilio E.164 format with 'whatsapp:' prefix
 * Accepts: "08123456789", "628123456789", "+628123456789"
 * Returns: "whatsapp:+628123456789"
 */
export function formatToTwilioWa(phone: string): string {
  if (phone.startsWith('whatsapp:')) {
    return phone;
  }
  let clean = phone.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  return `whatsapp:+${clean}`;
}

/**
 * Strip 'whatsapp:' and '+' from Twilio phone number format
 * Input: "whatsapp:+628123456789" -> "628123456789"
 */
export function cleanTwilioPhone(twilioPhone: string): string {
  let clean = twilioPhone.replace('whatsapp:', '');
  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  }
  return clean;
}

/**
 * Send a WhatsApp message via Twilio
 * @param to Recipient phone number (any format)
 * @param text Message body content
 * @param mediaUrl Optional array of media URLs (e.g. image, pdf)
 */
export async function sendTwilioMessage(
  to: string,
  text: string,
  mediaUrl?: string[]
): Promise<{ success: boolean; sid?: string; status?: string; error?: string }> {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken || !config.whatsappNumber) {
      console.error('[Twilio] Credentials not fully configured in settings.');
      return { success: false, error: 'Twilio credentials not configured' };
    }

    const client = twilio(config.accountSid, config.authToken);
    const toFormatted = formatToTwilioWa(to);
    const fromFormatted = formatToTwilioWa(config.whatsappNumber);

    const messageParams: {
      from: string;
      to: string;
      body: string;
      mediaUrl?: string[];
    } = {
      from: fromFormatted,
      to: toFormatted,
      body: text,
    };

    if (mediaUrl && mediaUrl.length > 0) {
      messageParams.mediaUrl = mediaUrl;
    }

    const message = await client.messages.create(messageParams);

    return {
      success: true,
      sid: message.sid,
      status: message.status,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[Twilio] Error sending message:', errorMsg);
    return {
      success: false,
      error: errorMsg || 'Unknown Twilio send error',
    };
  }
}

/**
 * Build assign notification message text (matches previous template)
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
