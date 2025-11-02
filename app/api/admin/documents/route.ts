import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';
import { logger, createRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();
    requestLogger.info('Admin documents fetch started');

    // Admin routes should use supabaseAdmin to bypass RLS
    const { data: documents, error } = await supabaseAdmin
      .from('regulatory_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      requestLogger.error('Failed to fetch documents', { error });
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    requestLogger.debug('Documents fetched successfully', {
      count: documents?.length,
      columns: documents && documents.length > 0 ? Object.keys(documents[0]) : [],
    });

    return NextResponse.json(documents);
  } catch (error: any) {
    requestLogger.error('Admin documents fetch failed', { error, message: error.message });

    // Handle auth errors with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();
    requestLogger.info('Admin document creation started');

    const body = await request.json();

    const { data: document, error } = await supabaseAdmin
      .from('regulatory_documents')
      .insert(body)
      .select()
      .single();

    if (error) {
      requestLogger.error('Failed to create document', { error, body });
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    requestLogger.info('Document created successfully', {
      documentId: document?.id,
      title: document?.title,
    });

    return NextResponse.json(document);
  } catch (error: any) {
    requestLogger.error('Admin document creation failed', { error, message: error.message });

    // Handle auth errors with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
