/**
 * AI Chatbot — WhatsApp onboarding flow for new contacts
 * 
 * State machine:
 *   null / undefined  → Start: greet + ask product interest
 *   "ask_name"        → Waiting for name
 *   "ask_domicile"    → Waiting for domicile
 *   "ask_complaint"   → Waiting for complaint/question
 *   "done"            → Onboarding complete, hand off to agent
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendWahaMessage } from '@/lib/waha';

type ChatbotData = {
  step?: string;
};

/**
 * Fetch active products for chatbot listing
 */
async function getActiveProducts(): Promise<string> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { name: true },
  });

  if (products.length === 0) return '';

  return products.map((p, i) => `  ${i + 1}. ${p.name}`).join('\n');
}

/**
 * Handle chatbot conversation flow for a contact
 * Returns true if chatbot handled the message (don't forward to human agent)
 * Returns false if onboarding is done (forward to agent)
 */
export async function handleChatbotFlow(
  contactId: string,
  currentState: string | null,
  incomingText: string,
  contactPhone: string
): Promise<boolean> {
  const trimmed = incomingText?.trim() || '';

  // ── STEP 0: New contact (no state yet) — start onboarding ──
  if (!currentState) {
    const productList = await getActiveProducts();
    const greeting =
      `Halo! 👋 Selamat datang di *Husada*.\n\n` +
      `Kami siap membantu Anda. Boleh kami tahu nama lengkap Anda?`;

    await sendWahaMessage(contactPhone, greeting);
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        chatbotState: 'ask_name',
        chatbotData: { productList },
      },
    });
    return true;
  }

const GREETINGS = [
  'halo', 'hello', 'hi', 'helo', 'ping', 'p', 'permisi', 'assalamualaikum', 'assalamu\'alaikum',
  'pagi', 'siang', 'sore', 'malam', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam',
  'test', 'tes', 'misi', 'kak', 'gan', 'bro', 'sis', 'min', 'admin'
];

function isGreeting(text: string): boolean {
  const clean = text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, '').trim();
  const words = clean.split(/\s+/);
  if (words.length <= 2) {
    return words.every(w => GREETINGS.includes(w));
  }
  return false;
}

  // ── STEP 1: Waiting for name ──
  if (currentState === 'ask_name') {
    if (trimmed.length < 2 || isGreeting(trimmed)) {
      await sendWahaMessage(contactPhone, 'Mohon perkenalkan nama lengkap Anda untuk memulai percakapan 🙏');
      return true;
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        fullName: trimmed,
        chatbotState: 'ask_domicile',
      },
    });

    await sendWahaMessage(
      contactPhone,
      `Terima kasih, *${trimmed}*! 😊\n\nBoleh tahu domisili Anda? (Contoh: Jakarta Selatan, Bandung, dll.)`
    );
    return true;
  }

  // ── STEP 2: Waiting for domicile ──
  if (currentState === 'ask_domicile') {
    if (trimmed.length < 2) {
      await sendWahaMessage(contactPhone, 'Mohon masukkan kota/domisili Anda 🙏');
      return true;
    }

    // Get existing chatbot data to retrieve product list
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { chatbotData: true },
    });
    const cbData = (contact?.chatbotData as ChatbotData | null) || {};

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        domicile: trimmed,
        chatbotState: 'ask_complaint',
        chatbotData: { ...cbData },
      },
    });

    const productList = await getActiveProducts();
    const productQuestion = productList
      ? `Ada pertanyaan atau keluhan tentang layanan apa yang ingin Anda tanyakan?\n\n` +
        `Layanan kami:\n${productList}\n\n` +
        `Silakan ketik pertanyaan atau pilih nomor layanan.`
      : `Ada pertanyaan atau keluhan apa yang ingin Anda sampaikan? Silakan ceritakan.`;

    await sendWahaMessage(contactPhone, productQuestion);
    return true;
  }

  // ── STEP 3: Waiting for complaint/product question ──
  if (currentState === 'ask_complaint') {
    if (trimmed.length < 2) {
      await sendWahaMessage(contactPhone, 'Mohon ceritakan keluhan atau pertanyaan Anda 🙏');
      return true;
    }

    // Try to match product by number selection
    let interestedProductId: string | undefined;
    const numericChoice = parseInt(trimmed);
    if (!isNaN(numericChoice)) {
      const products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });
      if (numericChoice >= 1 && numericChoice <= products.length) {
        interestedProductId = products[numericChoice - 1].id;
      }
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        chiefComplaint: trimmed,
        initialQuestion: trimmed,
        chatbotState: 'done',
        chatbotData: Prisma.DbNull,
        ...(interestedProductId ? { interestedProductId } : {}),
      },
    });

    await sendWahaMessage(
      contactPhone,
      `Terima kasih atas informasinya! 🙏\n\n` +
        `Tim kami akan segera menghubungi Anda. Mohon tunggu sebentar ya 😊`
    );

    return false; // Onboarding done, hand off to human agent
  }

  // ── State = "done" — pass through to human agent ──
  return false;
}
