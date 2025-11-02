import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';
import { logger, createRequestLogger } from '@/lib/logger';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/[id]' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();
    requestLogger.info('Admin document update started');

    const body = await request.json();
    const { id } = params;

    // Sanitize data: convert empty strings to null for date fields
    const sanitizedBody = {
      ...body,
      effective_date: body.effective_date === '' ? null : body.effective_date,
    };

    const { data: document, error } = await supabaseAdmin
      .from('regulatory_documents')
      .update(sanitizedBody)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      requestLogger.error('Failed to update document', { error, documentId: id });
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    requestLogger.info('Document updated successfully', {
      documentId: id,
      title: document?.title,
    });

    return NextResponse.json(document);
  } catch (error: any) {
    requestLogger.error('Admin document update failed', { error, message: error.message });

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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/[id]' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();
    requestLogger.info('Admin document deletion started');

    const { id } = params;

    // Actually delete the document from the database
    const { error } = await supabaseAdmin.from('regulatory_documents').delete().eq('id', id);

    if (error) {
      requestLogger.error('Failed to delete document', { error, documentId: id });
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    requestLogger.info('Document deleted successfully', { documentId: id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    requestLogger.error('Admin document deletion failed', { error, message: error.message });

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
