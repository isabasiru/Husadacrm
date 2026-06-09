import prisma from './src/lib/prisma';

async function main() {
  const allowedNumbers = ['082117071800', '6282117071800'];

  const contacts = await prisma.contact.findMany();
  
  let obfuscatedCount = 0;

  for (const contact of contacts) {
    if (!allowedNumbers.includes(contact.whatsappNumber) && !contact.whatsappNumber.endsWith('_dummy')) {
      const dummyNumber = `${contact.whatsappNumber}_dummy`;
      await prisma.contact.update({
        where: { id: contact.id },
        data: { whatsappNumber: dummyNumber }
      });
      obfuscatedCount++;
    }
  }

  // Check if our test number exists
  const testContact = await prisma.contact.findFirst({
    where: { 
      whatsappNumber: { in: allowedNumbers }
    }
  });

  if (!testContact) {
    // Create it
    const defaultStage = await prisma.stage.findFirst({ where: { isDefault: true } });
    await prisma.contact.create({
      data: {
        whatsappNumber: '6282117071800', // standard format
        fullName: 'Test User (Safe)',
        source: 'system_obfuscation',
        stageId: defaultStage?.id
      }
    });
    console.log('Created test contact 6282117071800');
  }

  console.log(`Successfully obfuscated ${obfuscatedCount} contacts to protect real patients.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
