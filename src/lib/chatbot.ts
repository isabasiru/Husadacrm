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

import { Prisma, Product } from '@prisma/client';
import prisma from '@/lib/prisma';
import { sendTwilioMessage } from '@/lib/twilio';

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
 * Fetch active parent products for chatbot listing
 */
async function getParentProducts() {
  return prisma.product.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Fetch active sub-products for a parent
 */
async function getSubProducts(parentId: string) {
  return prisma.product.findMany({
    where: { isActive: true, parentId },
    orderBy: { sortOrder: 'asc' },
  });
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

  // ── STEP 0: New contact (no state yet) — Greet and ask about product category ──
  if (!currentState || currentState === 'ask_product') {
    const parents = await getParentProducts();
    const parentList = parents.map((p, i) => `  ${i + 1}. ${p.name}`).join('\n');
    const productQuestion = parentList
      ? `Halo! 👋 Selamat datang di *Husada*.\n\n` +
        `Sebelum kami hubungkan dengan tim agen, layanan atau produk apa yang sedang Anda minati?\n\n` +
        `Layanan kami:\n${parentList}\n\n` +
        `Silakan ketik nomor layanan atau ceritakan keluhan Anda.`
      : `Halo! 👋 Selamat datang di *Husada*.\n\n` +
        `Sebelum kami hubungkan dengan tim agen, ada pertanyaan atau keluhan apa yang ingin Anda sampaikan? Silakan ceritakan.`;

    await sendTwilioMessage(contactPhone, productQuestion);
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        chatbotState: 'ask_product_parent',
      },
    });
    return true;
  }

  // ── STEP 1: Waiting for parent product choice / category selection ──
  if (currentState === 'ask_product_parent') {
    if (trimmed.length < 1) {
      await sendTwilioMessage(contactPhone, 'Mohon pilih layanan atau ceritakan keluhan Anda terlebih dahulu 🙏');
      return true;
    }

    // Try to match product category by number selection
    let chosenParent: Product | null = null;
    const numericChoice = parseInt(trimmed);
    if (!isNaN(numericChoice)) {
      const parents = await getParentProducts();
      if (numericChoice >= 1 && numericChoice <= parents.length) {
        chosenParent = parents[numericChoice - 1];
      }
    }

    if (chosenParent) {
      // Check if it has sub-products
      const subs = await getSubProducts(chosenParent.id);
      if (subs.length > 0) {
        const subList = subs.map((s, i) => `  ${i + 1}. ${s.name}`).join('\n');
        await sendTwilioMessage(
          contactPhone,
          `Menarik! Kami memiliki beberapa pilihan untuk *${chosenParent.name}*:\n\n${subList}\n\nSilakan ketik nomor pilihan Anda.`
        );
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            chatbotState: 'ask_product_child',
            chatbotData: { parentId: chosenParent.id, complaint: trimmed }
          },
        });
        return true;
      } else {
        // Direct match with no sub-products
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            chiefComplaint: chosenParent.name,
            initialQuestion: trimmed,
            interestedProductId: chosenParent.id,
            chatbotState: 'ask_name',
            chatbotData: Prisma.DbNull
          },
        });
        await sendTwilioMessage(contactPhone, `Terima kasih! Boleh kami tahu siapa nama lengkap Anda? 😊`);
        return true;
      }
    } else {
      // Fallback: treat text as initial query/complaint
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          chiefComplaint: trimmed,
          initialQuestion: trimmed,
          chatbotState: 'ask_name',
          chatbotData: Prisma.DbNull
        },
      });
      await sendTwilioMessage(contactPhone, `Terima kasih! Boleh kami tahu siapa nama lengkap Anda? 😊`);
      return true;
    }
  }

  // ── STEP 1.5: Waiting for specific sub-product choice ──
  if (currentState === 'ask_product_child') {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    const chatbotData = (contact?.chatbotData as Record<string, string | null>) || {};
    const parentId = chatbotData.parentId;

    if (!parentId) {
      // Reset back to parent question if state is corrupted
      await prisma.contact.update({ where: { id: contactId }, data: { chatbotState: 'ask_product_parent' } });
      return handleChatbotFlow(contactId, 'ask_product_parent', incomingText, contactPhone);
    }

    const numericChoice = parseInt(trimmed);
    let chosenSub: Product | null = null;
    const subs = await getSubProducts(parentId);

    if (!isNaN(numericChoice) && numericChoice >= 1 && numericChoice <= subs.length) {
      chosenSub = subs[numericChoice - 1];
    }

    if (chosenSub) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          chiefComplaint: chatbotData.complaint || chosenSub.name,
          interestedProductId: chosenSub.id,
          chatbotState: 'ask_name',
          chatbotData: Prisma.DbNull
        },
      });
      await sendTwilioMessage(contactPhone, `Terima kasih! Boleh kami tahu siapa nama lengkap Anda? 😊`);
      return true;
    } else {
      const subList = subs.map((s, i) => `  ${i + 1}. ${s.name}`).join('\n');
      await sendTwilioMessage(contactPhone, `Pilihan tidak valid. Silakan ketik nomor pilihan Anda:\n\n${subList}`);
      return true;
    }
  }

  // ── STEP 2: Waiting for name ──
  if (currentState === 'ask_name') {
    if (trimmed.length < 2 || isGreeting(trimmed)) {
      await sendTwilioMessage(contactPhone, 'Mohon perkenalkan nama lengkap Anda untuk melanjutkan onboarding 🙏');
      return true;
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        fullName: trimmed,
        chatbotState: 'ask_domicile',
      },
    });

    await sendTwilioMessage(
      contactPhone,
      `Terima kasih, *${trimmed}*! 😊\n\nDi kota/kabupaten mana domisili Anda saat ini?`
    );
    return true;
  }

  // ── STEP 3: Waiting for domicile ──
  if (currentState === 'ask_domicile') {
    if (trimmed.length < 2) {
      await sendTwilioMessage(contactPhone, 'Mohon masukkan kota/kabupaten domisili Anda 🙏');
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

    await sendTwilioMessage(
      contactPhone,
      `Terima kasih atas informasinya! 🙏\n\n` +
        `Tim kami akan segera menghubungi Anda. Mohon tunggu sebentar ya 😊`
    );

    return false; // Onboarding done, hand off to human agent
  }

  // ── State = "done" — pass through to human agent ──
  return false;
}
