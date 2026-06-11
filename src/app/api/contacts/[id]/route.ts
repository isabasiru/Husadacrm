import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// GET: Fetch a single contact details, including custom fields
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        stage: true,
        assignedAgent: true,
        customFields: true,
        tags: { include: { tag: true } },
        conversations: {
          where: { status: 'OPEN' },
          take: 1,
          include: {
            lastRepliedBy: {
              select: { fullName: true }
            }
          }
        }
      }
    });

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error('Error fetching contact:', error);
    return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}

// PATCH: Update contact details and custom fields
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const {
      fullName,
      whatsappNumber,
      age,
      domicile,
      chiefComplaint,
      initialQuestion,
      medicalSupportData,
      notes,
      stageId,
      assignedAgentId,
      revenue,
      client_type,
      chatbotState
    } = body;

    // Check if contact exists
    const existingContact = await prisma.contact.findUnique({
      where: { id }
    });

    if (!existingContact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Build update data, only including fields that are provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
    if (age !== undefined) updateData.age = age ? parseInt(age, 10) : null;
    if (domicile !== undefined) updateData.domicile = domicile;
    if (chiefComplaint !== undefined) updateData.chiefComplaint = chiefComplaint;
    if (initialQuestion !== undefined) updateData.initialQuestion = initialQuestion;
    if (medicalSupportData !== undefined) updateData.medicalSupportData = medicalSupportData;
    if (notes !== undefined) updateData.notes = notes;
    if (stageId !== undefined) updateData.stageId = stageId === 'null' ? null : stageId;
    if (assignedAgentId !== undefined) updateData.assignedAgentId = assignedAgentId === 'null' ? null : assignedAgentId;
    if (chatbotState !== undefined) updateData.chatbotState = chatbotState;

    // Perform database updates
    await prisma.contact.update({
      where: { id },
      data: updateData,
    });

    // Handle custom fields upserts
    if (revenue !== undefined) {
      const fieldKey = 'revenue';
      const existingField = await prisma.contactCustomField.findFirst({
        where: { contactId: id, fieldKey }
      });
      if (existingField) {
        await prisma.contactCustomField.update({
          where: { id: existingField.id },
          data: { fieldValue: String(revenue || '0') }
        });
      } else {
        await prisma.contactCustomField.create({
          data: {
            contactId: id,
            fieldKey,
            fieldValue: String(revenue || '0'),
            fieldType: 'number'
          }
        });
      }
    }

    if (client_type !== undefined) {
      const fieldKey = 'client_type';
      const existingField = await prisma.contactCustomField.findFirst({
        where: { contactId: id, fieldKey }
      });
      if (existingField) {
        await prisma.contactCustomField.update({
          where: { id: existingField.id },
          data: { fieldValue: String(client_type || '') }
        });
      } else {
        await prisma.contactCustomField.create({
          data: {
            contactId: id,
            fieldKey,
            fieldValue: String(client_type || ''),
            fieldType: 'text'
          }
        });
      }
    }

    // Refetch the complete contact object with relations
    const finalContact = await prisma.contact.findUnique({
      where: { id },
      include: {
        stage: true,
        assignedAgent: true,
        customFields: true,
        tags: { include: { tag: true } }
      }
    });

    return NextResponse.json({
      success: true,
      contact: finalContact
    });
  } catch (error) {
    console.error('Error updating contact:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}

// DELETE: Hapus kontak beserta semua data terkait
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const existingContact = await prisma.contact.findUnique({ where: { id } });
    if (!existingContact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    // Hapus contact — relasi cascade (customFields, tags, assignHistory, followUps, conversations→messages) otomatis terhapus
    await prisma.contact.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
