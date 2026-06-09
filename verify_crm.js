const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const databaseUrl = process.env.DATABASE_URL;
const wahaUrl = process.env.WAHA_API_URL || 'http://webhaus-waha:3000';
const wahaKey = process.env.WAHA_API_KEY || 'webhaus-waha-key';

async function runChecks() {
  console.log('==================================================');
  console.log('🩺 HUSADA CRM SYSTEM VERIFICATION & AUDIT TOOL');
  console.log('==================================================\n');

  let checklist = [];
  let isDbOk = false;

  // 1. Check Environment Variables
  console.log('📋 1. Checking Environment Variables...');
  const requiredEnvs = ['DATABASE_URL', 'JWT_SECRET', 'WAHA_API_URL', 'WAHA_API_KEY'];
  let envsMissing = false;
  
  requiredEnvs.forEach(env => {
    if (process.env[env]) {
      console.log(`   ✅ ${env}: Present`);
    } else {
      console.log(`   ❌ ${env}: MISSING!`);
      envsMissing = true;
    }
  });

  checklist.push({
    task: 'Environment variables configured',
    status: envsMissing ? 'FAILED' : 'PASSED',
    details: envsMissing ? 'Some critical env variables are missing.' : 'All required env variables are present.'
  });

  // 2. Check Database Connection & Data Integrity
  console.log('\n🗄️  2. Checking Database Connectivity (Prisma & PG Pool)...');
  if (!databaseUrl) {
    console.log('   ❌ DATABASE_URL is not set, skipping database checks.');
    checklist.push({ task: 'Database connectivity', status: 'FAILED', details: 'DATABASE_URL env variable not set.' });
  } else {
    const pool = new Pool({ connectionString: databaseUrl });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
      // Test raw query
      await pool.query('SELECT NOW()');
      console.log('   ✅ PostgreSQL Pool Connection: Success');
      
      // Test Prisma query
      const userCount = await prisma.user.count();
      const stageCount = await prisma.stage.count();
      const templateCount = await prisma.messageTemplate.count();
      const contactCount = await prisma.contact.count();
      const messageCount = await prisma.message.count();

      console.log('   ✅ Prisma Query Execution: Success');
      console.log(`      - Users: ${userCount}`);
      console.log(`      - Stages: ${stageCount}`);
      console.log(`      - Message Templates: ${templateCount}`);
      console.log(`      - Contacts: ${contactCount}`);
      console.log(`      - Messages: ${messageCount}`);

      isDbOk = true;

      // Validate Seeding
      let seedIssues = [];
      if (userCount === 0) seedIssues.push('No users found in database.');
      if (stageCount === 0) seedIssues.push('No stages found. Seeding is required.');
      if (templateCount === 0) seedIssues.push('No message templates found.');

      const hasAdmin = await prisma.user.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } }
      });
      if (!hasAdmin) seedIssues.push('No administrator user (ADMIN/SUPER_ADMIN) exists.');

      checklist.push({
        task: 'Database connectivity & queries',
        status: 'PASSED',
        details: `Connected successfully. Users: ${userCount}, Stages: ${stageCount}, Templates: ${templateCount}`
      });

      checklist.push({
        task: 'Default seeded data validity',
        status: seedIssues.length > 0 ? 'WARNING' : 'PASSED',
        details: seedIssues.length > 0 ? seedIssues.join(' ') : 'Default admin, stages, and quick reply templates exist.'
      });

    } catch (err) {
      console.log(`   ❌ Database connection failed: ${err.message}`);
      checklist.push({
        task: 'Database connectivity & queries',
        status: 'FAILED',
        details: `Connection error: ${err.message}`
      });
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }

  // 3. Check WhatsApp Engine (WAHA) Connectivity
  console.log('\n🟢 3. Checking WhatsApp Engine (WAHA) Connectivity...');
  try {
    const res = await fetch(`${wahaUrl}/api/sessions`, {
      headers: { 'X-Api-Key': wahaKey }
    });
    
    if (res.ok) {
      const sessions = await res.json();
      console.log(`   ✅ WAHA HTTP API responds (Status: ${res.status})`);
      console.log(`   ✅ WAHA Sessions fetched: ${sessions.length} active session(s)`);
      sessions.forEach(s => {
        console.log(`      - Session: "${s.name}" (Status: ${s.status})`);
      });
      
      checklist.push({
        task: 'WhatsApp Engine (WAHA) connection',
        status: 'PASSED',
        details: `Connected to WAHA. Found ${sessions.length} sessions.`
      });
    } else {
      console.log(`   ❌ WAHA API responded with error status: ${res.status}`);
      checklist.push({
        task: 'WhatsApp Engine (WAHA) connection',
        status: 'FAILED',
        details: `WAHA API responded with error status: ${res.status}`
      });
    }
  } catch (err) {
    console.log(`   ❌ Failed to connect to WAHA at ${wahaUrl}: ${err.message}`);
    checklist.push({
      task: 'WhatsApp Engine (WAHA) connection',
      status: 'FAILED',
      details: `Failed to connect: ${err.message}. Make sure WAHA container is running.`
    });
  }

  // 4. Check Local Next.js Web Server Port
  console.log('\n🌐 4. Checking Next.js Web Server Port (Localhost:3000)...');
  try {
    const res = await fetch('http://localhost:3000');
    console.log(`   ✅ Local Next.js server responds (Status: ${res.status})`);
    checklist.push({
      task: 'Next.js Web Server Port 3000',
      status: 'PASSED',
      details: `Port 3000 responds with status ${res.status}.`
    });
  } catch (err) {
    console.log(`   ❌ Local Next.js server is not reachable on port 3000: ${err.message}`);
    checklist.push({
      task: 'Next.js Web Server Port 3000',
      status: 'WARNING',
      details: `Port 3000 not reachable from within container (${err.message}). Expected in some standalone node modes.`
    });
  }

  // Print Summary Checklist
  console.log('\n==================================================');
  console.log('📊 SUMMARY VERIFICATION CHECKLIST');
  console.log('==================================================');
  
  let overallPassed = true;
  checklist.forEach(item => {
    let statusIcon = '✅';
    if (item.status === 'WARNING') statusIcon = '⚠️';
    if (item.status === 'FAILED') {
      statusIcon = '❌';
      overallPassed = false;
    }
    console.log(`${statusIcon} [${item.status}] - ${item.task}`);
    console.log(`   Detail: ${item.details}`);
  });

  console.log('\n==================================================');
  if (overallPassed) {
    console.log('🎉 SYSTEM RESULT: ALL KEY COMPONENT CHECKS PASSED!');
  } else {
    console.log('⚠️  SYSTEM RESULT: SOME CHECKS FAILED OR NEED ATTENTION!');
  }
  console.log('==================================================\n');
}

runChecks().catch(err => {
  console.error('Fatal error during system checks:', err);
});
