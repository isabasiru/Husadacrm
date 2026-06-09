const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting LID resolution and merge script...');
  const contacts = await prisma.contact.findMany();
  
  const WAHA_URL = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
  const WAHA_KEY = process.env.WAHA_API_KEY || 'webhaus-waha-key';

  for (const contact of contacts) {
    const num = contact.whatsappNumber;
    if (num.includes('@lid') || num.endsWith('lid')) {
      console.log(`Found LID contact: ${contact.fullName} (${num})`);
      
      try {
        const lidClean = num.includes('@') ? num : `${num}@lid`;
        const res = await fetch(`${WAHA_URL}/api/default/lids/${lidClean}`, {
          headers: {
            'X-Api-Key': WAHA_KEY,
            'Accept': 'application/json',
          }
        });
        if (!res.ok) {
          console.error(`Failed to resolve LID ${num} from WAHA: ${res.statusText}`);
          continue;
        }
        const data = await res.json();
        if (data && data.pn) {
          let resolvedNumber = data.pn;
          if (resolvedNumber.endsWith('@c.us')) {
            resolvedNumber = resolvedNumber.split('@')[0];
          }
          console.log(`Resolved LID ${num} to phone number ${resolvedNumber}`);
          
          // Check if a contact with this resolved number already exists
          const existingContact = await prisma.contact.findUnique({
            where: { whatsappNumber: resolvedNumber }
          });
          
          if (existingContact) {
            console.log(`Duplicate contact found with number ${resolvedNumber}. Merging...`);
            
            // 1. Move all conversations from LID contact to existing contact
            const conversations = await prisma.conversation.findMany({
              where: { contactId: contact.id }
            });
            
            for (const conv of conversations) {
              // Check if the existing contact already has an OPEN conversation
              if (conv.status === 'OPEN') {
                const existingOpenConv = await prisma.conversation.findFirst({
                  where: { contactId: existingContact.id, status: 'OPEN' }
                });
                if (existingOpenConv) {
                  // If both have open conversations, move all messages to the existing open conversation
                  console.log(`Merging messages from conversation ${conv.id} to ${existingOpenConv.id}`);
                  await prisma.message.updateMany({
                    where: { conversationId: conv.id },
                    data: { conversationId: existingOpenConv.id }
                  });
                  // Delete the redundant conversation
                  await prisma.conversation.delete({ where: { id: conv.id } });
                  continue;
                }
              }
              
              // Otherwise, just move the conversation
              await prisma.conversation.update({
                where: { id: conv.id },
                data: { contactId: existingContact.id }
              });
            }
            
            // 2. Move assign history
            await prisma.assignHistory.updateMany({
              where: { contactId: contact.id },
              data: { contactId: existingContact.id }
            });
            
            // 3. Move tags
            const tags = await prisma.contactTag.findMany({
              where: { contactId: contact.id }
            });
            for (const tag of tags) {
              const hasTag = await prisma.contactTag.findFirst({
                where: { contactId: existingContact.id, tagId: tag.tagId }
              });
              if (!hasTag) {
                await prisma.contactTag.create({
                  data: { contactId: existingContact.id, tagId: tag.tagId }
                });
              }
              await prisma.contactTag.delete({
                where: { contactId_tagId: { contactId: contact.id, tagId: tag.tagId } }
              });
            }

            // 4. Delete the LID contact
            await prisma.contact.delete({
              where: { id: contact.id }
            });
            console.log(`Successfully merged and deleted LID contact ${num}`);
            
          } else {
            // No duplicate contact exists, just update the number
            await prisma.contact.update({
              where: { id: contact.id },
              data: { whatsappNumber: resolvedNumber }
            });
            console.log(`Updated WhatsApp number for contact ${contact.fullName} to ${resolvedNumber}`);
          }
        }
      } catch (err) {
        console.error(`Failed to merge contact ${num}:`, err);
      }
    }
  }
  console.log('LID resolution and merge complete.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
