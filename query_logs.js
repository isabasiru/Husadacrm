const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Querying SystemSettings...');
  const settings = await prisma.systemSetting.findMany();
  console.log('Settings:', settings);

  console.log('\nQuerying Auto Follow-Up Activity Logs...');
  const logs = await prisma.activityLog.findMany({
    where: { action: 'auto_followup' }
  });
  console.log('Activity Logs:', logs);

  console.log('\nQuerying Messages sent by System User...');
  const messages = await prisma.message.findMany({
    where: { sentById: 'de5118a9-d0d0-4d14-9670-13e3e56b5116' }
  });
  console.log('System Messages:', messages);
}

main().catch(console.error).finally(() => pool.end());
