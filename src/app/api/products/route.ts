import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/products — List all products
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST /api/products — Create a new product (ADMIN/SUPER_ADMIN only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, category, isActive, sortOrder } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        isActive: isActive !== false,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
