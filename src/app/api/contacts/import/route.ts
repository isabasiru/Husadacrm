import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contacts/import
 * Body: multipart/form-data with field "file" (.xlsx or .csv)
 * Returns: { inserted, skipped, errors }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return NextResponse.json({ error: 'Only .xlsx, .xls, or .csv files are allowed' }, { status: 400 });
    }

    // Parse file
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 });
    }

    // Fetch default stage for new contacts
    const defaultStage = await prisma.stage.findFirst({ where: { isDefault: true } });

    // Fetch all stages and products for name-matching
    const stages = await prisma.stage.findMany();
    const products = await prisma.product.findMany({ where: { isActive: true } });

    let inserted = 0;
    let skipped = 0;
    const errors: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      // Flexible column mapping (case-insensitive, various naming)
      const normalize = (key: string) => key.trim().toLowerCase().replace(/[\s_-]/g, '');
      const getValue = (keys: string[]) => {
        for (const row_key of Object.keys(row)) {
          if (keys.includes(normalize(row_key))) return String(row[row_key]).trim();
        }
        return '';
      };

      const phone = getValue(['nowa', 'nohp', 'whatsapp', 'phone', 'nomor', 'nomorwa', 'nomorhp', 'hp', 'telepon']);
      const name = getValue(['nama', 'name', 'fullname', 'namalengkap', 'pasien']);
      const domicile = getValue(['domisili', 'kota', 'city', 'domicile', 'alamat']);
      const notes = getValue(['catatan', 'notes', 'keterangan', 'note']);
      const stageName = getValue(['stage', 'status', 'tahap']);
      const productName = getValue(['produk', 'product', 'layanan', 'service', 'minat']);

      // Validate phone
      if (!phone) {
        errors.push({ row: rowNum, reason: 'Nomor WhatsApp kosong' });
        continue;
      }

      // Normalize phone number
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
      if (!cleanPhone.startsWith('62')) cleanPhone = '62' + cleanPhone;

      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push({ row: rowNum, reason: `Nomor tidak valid: ${phone}` });
        continue;
      }

      // Check for duplicate
      const existing = await prisma.contact.findUnique({ where: { whatsappNumber: cleanPhone } });
      if (existing) {
        skipped++;
        continue;
      }

      // Match stage
      let stageId = defaultStage?.id;
      if (stageName) {
        const matchedStage = stages.find(s =>
          s.name.toLowerCase() === stageName.toLowerCase()
        );
        if (matchedStage) stageId = matchedStage.id;
      }

      // Match product
      let interestedProductId: string | undefined;
      if (productName) {
        const matchedProduct = products.find(p =>
          p.name.toLowerCase().includes(productName.toLowerCase()) ||
          productName.toLowerCase().includes(p.name.toLowerCase())
        );
        if (matchedProduct) interestedProductId = matchedProduct.id;
      }

      try {
        await prisma.contact.create({
          data: {
            whatsappNumber: cleanPhone,
            fullName: name || null,
            domicile: domicile || null,
            notes: notes || null,
            stageId,
            interestedProductId,
            chatbotState: 'done', // Imported contacts skip chatbot
            source: 'import',
          }
        });
        inserted++;
      } catch (err) {
        errors.push({ row: rowNum, reason: `DB error: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      errors,
      total: rows.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to process import' }, { status: 500 });
  }
}
