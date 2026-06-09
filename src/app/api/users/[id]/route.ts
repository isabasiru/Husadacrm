import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// PATCH: Update user details (Admin/Super Admin only)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, fullName, role, password, isActive, whatsappNumber } = body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (fullName !== undefined) updateData.fullName = fullName;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (whatsappNumber !== undefined) {
      updateData.whatsappNumber = whatsappNumber ? whatsappNumber.trim() : null;
    }
    
    if (role !== undefined) {
      const validRoles = ['SUPER_ADMIN', 'ADMIN', 'AGENT'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateData.role = role;
    }

    if (email !== undefined) {
      const formattedEmail = email.toLowerCase().trim();
      if (formattedEmail !== existingUser.email) {
        // Check duplicate email
        const duplicate = await prisma.user.findUnique({
          where: { email: formattedEmail }
        });
        if (duplicate) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }
        updateData.email = formattedEmail;
      }
    }

    if (password !== undefined && password !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        whatsappNumber: true,
        updatedAt: true,
      }
    });

    return NextResponse.json(updatedUser);

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE: Deactivate a user (soft delete / active toggle)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prevent deactivating own account
    if (session.userId === id) {
      return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // We do a soft delete by toggling isActive to false
    const deactivatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
      }
    });

    return NextResponse.json({ success: true, user: deactivatedUser });
  } catch (error) {
    console.error('Error deactivating user:', error);
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}
