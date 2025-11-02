import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

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
      console.error('Error updating document:', error);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Error in PUT /api/admin/documents/[id]:', error);

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
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

    const { id } = params;

    // Actually delete the document from the database
    const { error } = await supabaseAdmin.from('regulatory_documents').delete().eq('id', id);

    if (error) {
      console.error('Error deleting document:', error);
      return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/documents/[id]:', error);

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
