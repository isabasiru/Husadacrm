import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...');

  // 1. Seed Stages
  const stages = [
    { name: 'Proses Screening', color: '#8B5CF6', orderIndex: 1, isDefault: true, isTerminal: false },
    { name: 'Dalam Proses', color: '#3B82F6', orderIndex: 2, isDefault: false, isTerminal: false },
    { name: 'FU Ulang', color: '#F59E0B', orderIndex: 3, isDefault: false, isTerminal: false },
    { name: 'Closed', color: '#10B981', orderIndex: 4, isDefault: false, isTerminal: true },
  ];

  for (const stage of stages) {
    await prisma.stage.upsert({
      where: { name: stage.name },
      update: stage,
      create: stage,
    });
  }
  console.log('Seeded Stages');

  // 2. Seed Default Message Templates (Quick Replies)
  const templates = [
    {
      name: 'Sapaan Awal',
      category: 'GREETING',
      content: 'Halo kak {{nama}}, perkenalkan saya {{agent_name}} dari Husada. Ada yang bisa saya bantu terkait keluhan yang dialami?',
      variables: { variables: ['nama', 'agent_name'] }
    },
    {
      name: 'Follow Up',
      category: 'FOLLOW_UP',
      content: 'Halo kak {{nama}}, bagaimana kondisinya hari ini? Apakah keluhannya sudah berkurang?',
      variables: { variables: ['nama'] }
    },
    {
      name: 'Penutup / Closed',
      category: 'CLOSING',
      content: 'Baik kak {{nama}}, terima kasih atas informasinya. Jika ada keluhan lebih lanjut, jangan ragu untuk menghubungi kami kembali. Sehat selalu!',
      variables: { variables: ['nama'] }
    }
  ];

  // Assuming Super Admin exists to assign as creator, or we just leave createdById null if optional.
  // The schema says createdById is String? so it can be null.
  for (const tpl of templates) {
    // We can't easily upsert by name if it's not unique in schema, but schema doesn't have @unique on name for MessageTemplate.
    // Let's just create if not exists by doing a findFirst
    const existing = await prisma.messageTemplate.findFirst({ where: { name: tpl.name } });
    if (!existing) {
      await prisma.messageTemplate.create({ data: tpl });
    }
  }
  console.log('Seeded Message Templates');

  // 3. Seed Default Super Admin (if none exists)
  const adminExists = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!adminExists) {
    const passwordHash = await bcrypt.hash('AdminHusada123!', 10);
    await prisma.user.create({
      data: {
        email: 'admin@husada.webhaus.id',
        passwordHash,
        fullName: 'Super Admin Husada',
        role: 'SUPER_ADMIN',
      }
    });
    console.log('Seeded Default Super Admin');
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
