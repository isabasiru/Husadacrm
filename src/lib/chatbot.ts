/**
 * AI Chatbot — WhatsApp onboarding flow for new contacts
 * 
 * State machine (restructured to ask product interest first):
 *   null / undefined  → Start: greet + ask product interest
 *   "ask_product"     → Save product / complaint, ask for name
 *   "ask_name"        → Save name (filter greetings), ask for domicile
 *   "ask_domicile"    → Save domicile, mark "done" and thank user
 *   "done"            → Onboarding complete, hand off to agent
 */

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendWahaMessage } from '@/lib/waha';

type ChatbotData = {
  step?: string;
};

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

  // ── STEP 0: New contact (no state yet) — Greet and ask about product ──
  if (!currentState) {
    const productList = await getActiveProducts();
    const productQuestion = productList
      ? `Halo! 👋 Selamat datang di *Husada*.\n\n` +
        `Sebelum kami hubungkan dengan tim agen, layanan atau produk apa yang sedang Anda minati?\n\n` +
        `Layanan kami:\n${productList}\n\n` +
        `Silakan ketik nomor layanan atau ceritakan keluhan Anda.`
      : `Halo! 👋 Selamat datang di *Husada*.\n\n` +
        `Sebelum kami hubungkan dengan tim agen, ada pertanyaan atau keluhan apa yang ingin Anda sampaikan? Silakan ceritakan.`;

    await sendWahaMessage(contactPhone, productQuestion);
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        chatbotState: 'ask_product',
      },
    });
    return true;
  }

  // ── STEP 1: Waiting for product choice / complaint ──
  if (currentState === 'ask_product') {
    if (trimmed.length < 2) {
      await sendWahaMessage(contactPhone, 'Mohon pilih layanan atau ceritakan keluhan Anda terlebih dahulu 🙏');
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
        chatbotState: 'ask_name',
        ...(interestedProductId ? { interestedProductId } : {}),
      },
    });

    await sendWahaMessage(
      contactPhone,
      `Terima kasih! Boleh kami tahu siapa nama lengkap Anda? 😊`
    );
    return true;
  }

  // ── STEP 2: Waiting for name ──
  if (currentState === 'ask_name') {
    if (trimmed.length < 2 || isGreeting(trimmed)) {
      await sendWahaMessage(contactPhone, 'Mohon perkenalkan nama lengkap Anda untuk melanjutkan onboarding 🙏');
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
      `Terima kasih, *${trimmed}*! 😊\n\nDi kota/kabupaten mana domisili Anda saat ini?`
    );
    return true;
  }

  // ── STEP 3: Waiting for domicile ──
  if (currentState === 'ask_domicile') {
    if (trimmed.length < 2) {
      await sendWahaMessage(contactPhone, 'Mohon masukkan kota/kabupaten domisili Anda 🙏');
      return true;
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        domicile: trimmed,
        chatbotState: 'done',
        chatbotData: Prisma.DbNull,
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
