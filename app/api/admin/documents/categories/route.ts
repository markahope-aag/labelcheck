import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDocumentsWithCategories } from '@/lib/regulatory-documents';
import { logger, createRequestLogger } from '@/lib/logger';

/**
 * GET /api/admin/documents/categories
 * Returns all documents with their detected product categories for RAG lite preview
 */
export async function GET(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/categories' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized document categories fetch attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestLogger.info('Document categories fetch started', { userId });

    // Get documents with detected categories
    const documentsWithCategories = await getDocumentsWithCategories();

    requestLogger.debug('Document categories fetched successfully', {
      count: documentsWithCategories?.length,
    });

    return NextResponse.json(documentsWithCategories);
  } catch (error: any) {
    requestLogger.error('Document categories fetch failed', { error, message: error.message });
    return NextResponse.json({ error: 'Failed to fetch document categories' }, { status: 500 });
  }
}
