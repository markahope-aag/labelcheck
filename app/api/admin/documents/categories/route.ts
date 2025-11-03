import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getDocumentsWithCategories } from '@/lib/regulatory-documents';
import { logger, createRequestLogger } from '@/lib/logger';
import { handleApiError, AuthenticationError, AuthorizationError } from '@/lib/error-handler';

/**
 * GET /api/admin/documents/categories
 * Returns all documents with their detected product categories for RAG lite preview
 */
export async function GET(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/categories' });

  try {
    const { userId } = await auth();

    if (!userId) {
      throw new AuthenticationError();
    }

    // Check if user is admin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (!user || !user.is_system_admin) {
      throw new AuthorizationError('Admin access required');
    }

    requestLogger.info('Document categories fetch started', { userId });

    // Get documents with detected categories
    const documentsWithCategories = await getDocumentsWithCategories();

    requestLogger.debug('Document categories fetched successfully', {
      count: documentsWithCategories?.length,
    });

    return NextResponse.json(documentsWithCategories);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
