import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDocumentsWithCategories } from '@/lib/regulatory-documents';

/**
 * GET /api/admin/documents/categories
 * Returns all documents with their detected product categories for RAG lite preview
 */
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get documents with detected categories
    const documentsWithCategories = await getDocumentsWithCategories();

    return NextResponse.json(documentsWithCategories);
  } catch (error: any) {
    console.error('Error fetching document categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document categories' },
      { status: 500 }
    );
  }
}
