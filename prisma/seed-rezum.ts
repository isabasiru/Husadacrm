/**
 * Seed script: Import 50 leads from REZUM TALCO.xlsx
 * Run: npx tsx prisma/seed-rezum.ts
 *
 * Excel columns:
 * Nama Pasien | Usia | Domisili | No Telp | Keluhan | Pertanyaan |
 * PENUNJANG | FR | Status | FU/RC | Note RC | Tanggal mulai |
 * Tanggal akhir | Pencapaian | Catatan | Revenue
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as XLSX from 'xlsx';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Normalize phone to 62xxx format
function normalizePhone(raw: string | number | null | undefined): string | null {
  if (!raw) return null;
  let clean = String(raw).replace(/\D/g, '');
  if (clean.length < 8) return null;
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  if (!clean.startsWith('62')) clean = '62' + clean;
  if (clean.length < 10 || clean.length > 15) return null;
  return clean;
}

// Map Excel "Status" to CRM stage name
function mapStatus(status: string): string {
  const s = (status || '').toLowerCase().trim();
  if (s.includes('closed') || s.includes('deal')) return 'Closed';
  if (s.includes('proses') || s.includes('process')) return 'Dalam Proses';
  if (s.includes('prospect')) return 'Prospect';
  return 'Baru';
}

async function main() {
  console.log('🌱 Starting Rezum Talco seed...');

  // Load Excel file
  const excelPath = path.resolve(__dirname, '../../Copy of REZUM TALCO.xlsx');
  const workbook = XLSX.readFile(excelPath);
  const sheet = workbook.Sheets['Sheet1'];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  console.log(`📊 Total rows in Excel: ${rows.length}`);

  // Find/create REZUM product
  let rezumProduct = await prisma.product.findFirst({
    where: { name: { contains: 'REZUM', mode: 'insensitive' } }
  });

  if (!rezumProduct) {
    rezumProduct = await prisma.product.create({
      data: {
        name: 'REZUM WATER VAPOR THERAPY',
        description: 'REZUM WATER VAPOR THERAPY - SOLUSI MODERN UNTUK MASALAH PROSTAT\n\nKeunggulan Rezum:\n- Minimal Invasif\n- Minimal Komplikasi\n- Tanpa Sayatan\n- Minimal Pendarahan\n- Prosedur Singkat\n- Cepat Pulih',
        category: 'Urologi',
        isActive: true,
        sortOrder: 1,
      }
    });
    console.log('✅ Created REZUM product');
  }

  // Fetch all stages
  const stages = await prisma.stage.findMany();
  const defaultStage = stages.find(s => s.isDefault) || stages[0];

  const findStage = (statusRaw: string) => {
    const targetName = mapStatus(statusRaw);
    return stages.find(s => s.name.toLowerCase().includes(targetName.toLowerCase())) || defaultStage;
  };

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  const TARGET = 50;

  for (const row of rows) {
    if (inserted >= TARGET) break;

    const rawPhone = row['No Telp'] as string | number | null;
    const phone = normalizePhone(rawPhone);

    if (!phone) {
      skipped++;
      continue;
    }

    // Check duplicate
    const exists = await prisma.contact.findUnique({ where: { whatsappNumber: phone } });
    if (exists) {
      skipped++;
      continue;
    }

    const name = String(row['Nama Pasien'] || '').trim() || null;
    const usia = row['Usia'] ? Number(row['Usia']) : null;
    const domisili = String(row['Domisili'] || '').trim() || null;
    const keluhan = String(row['Keluhan'] || '').trim() || null;
    const pertanyaan = String(row['Pertanyaan'] || '').trim() || null;
    const penunjang = String(row['PENUNJANG'] || '').trim() || null;
    const statusRaw = String(row['Status'] || '').trim();
    const catatan = String(row['Catatan'] || row['Note RC'] || '').trim() || null;

    const stage = findStage(statusRaw);

    try {
      await prisma.contact.create({
        data: {
          whatsappNumber: phone,
          fullName: name,
          age: usia && !isNaN(usia) ? usia : null,
          domicile: domisili,
          chiefComplaint: keluhan,
          initialQuestion: pertanyaan,
          medicalSupportData: penunjang,
          notes: catatan,
          stageId: stage?.id,
          interestedProductId: rezumProduct.id,
          chatbotState: 'done', // Skip chatbot for seeded contacts
          source: 'import_rezum_talco',
        }
      });
      inserted++;
      if (inserted % 10 === 0) console.log(`  ✅ Inserted ${inserted}/${TARGET}...`);
    } catch (err) {
      console.error(`  ❌ Row error (${phone}):`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log('\n🎉 Seed complete!');
  console.log(`   ✅ Inserted: ${inserted}`);
  console.log(`   ⏭️  Skipped:  ${skipped} (no phone / duplicate)`);
  console.log(`   ❌ Errors:   ${errors}`);
}

main()
  .catch((e) => {
    console.error('Fatal seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
