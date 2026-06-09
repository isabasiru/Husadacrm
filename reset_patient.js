const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const phone = '6282117071800';
  console.log(`Resetting patient ${phone}...`);

  const contact = await prisma.contact.findUnique({
    where: { whatsappNumber: phone }
  });

  if (!contact) {
    console.log(`Contact ${phone} not found.`);
    return;
  }

  // 1. Find conversations
  const conversations = await prisma.conversation.findMany({
    where: { contactId: contact.id }
  });

  const convIds = conversations.map(c => c.id);

  // 2. Delete messages
  if (convIds.length > 0) {
    const deletedMsgs = await prisma.message.deleteMany({
      where: { conversationId: { in: convIds } }
    });
    console.log(`Deleted ${deletedMsgs.count} messages.`);
  }

  // 3. Delete conversations
  const deletedConvs = await prisma.conversation.deleteMany({
    where: { contactId: contact.id }
  });
  console.log(`Deleted ${deletedConvs.count} conversations.`);

  // 4. Delete related histories/tags
  await prisma.assignHistory.deleteMany({ where: { contactId: contact.id } });
  await prisma.contactTag.deleteMany({ where: { contactId: contact.id } });
  await prisma.contactCustomField.deleteMany({ where: { contactId: contact.id } });
  await prisma.followUp.deleteMany({ where: { contactId: contact.id } });

  // 5. Reset contact fields and set proper name
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      fullName: 'Isa Herdyanto',
      chatbotState: 'done',
      chatbotData: null,
      chiefComplaint: null,
      initialQuestion: null,
      interestedProductId: null,
      domicile: null,
      lastInteractionAt: null,
      totalMessages: 0,
    }
  });

  // 6. Disable chatbot globally in system settings
  await prisma.systemSetting.upsert({
    where: { key: 'chatbot_enabled' },
    update: { value: 'false' },
    create: { key: 'chatbot_enabled', value: 'false' }
  });

  console.log(`Contact ${phone} reset successfully with name Isa Herdyanto and chatbot disabled!`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
