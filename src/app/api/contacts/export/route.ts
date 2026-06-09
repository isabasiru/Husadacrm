import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import * as XLSX from 'xlsx';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contacts/export
 * Query params: agentId, stageId — same filters as leads page
 * Returns: Excel file download
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || 'all';
    const stageId = searchParams.get('stageId') || 'all';

    const whereClause: Prisma.ContactWhereInput = {};

    // Role-based: agents can only export their own contacts
    if (session.role === 'AGENT') {
      whereClause.assignedAgentId = session.userId;
    } else if (agentId !== 'all') {
      whereClause.assignedAgentId = agentId;
    }

    if (stageId !== 'all') {
      whereClause.stageId = stageId;
    }

    const contacts = await prisma.contact.findMany({
      where: whereClause,
      include: {
        stage: { select: { name: true } },
        assignedAgent: { select: { fullName: true } },
        interestedProduct: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build Excel rows
    const rows = contacts.map((c, i) => ({
      'No': i + 1,
      'Nama': c.fullName || '',
      'No WhatsApp': c.whatsappNumber,
      'Domisili': c.domicile || '',
      'Produk Minat': c.interestedProduct?.name || '',
      'Stage': c.stage?.name || '',
      'Admin Assign': c.assignedAgent?.fullName || '',
      'Keluhan / Pertanyaan': c.chiefComplaint || '',
      'Catatan': c.notes || '',
      'Sumber': c.source || '',
      'Tanggal Masuk': c.createdAt.toLocaleDateString('id-ID'),
      'Update Terakhir': c.updatedAt.toLocaleDateString('id-ID'),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 30 },
      { wch: 15 }, { wch: 20 }, { wch: 40 }, { wch: 30 }, { wch: 15 },
      { wch: 15 }, { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="husada-leads-${today}.xlsx"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export contacts' }, { status: 500 });
  }
}
