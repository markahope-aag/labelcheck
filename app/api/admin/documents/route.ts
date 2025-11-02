import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

    // Admin routes should use supabaseAdmin to bypass RLS
    const { data: documents, error } = await supabaseAdmin
      .from('regulatory_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    // Log the structure of the first document to see what columns exist
    if (documents && documents.length > 0) {
      console.log('Database columns:', Object.keys(documents[0]));
    }

    return NextResponse.json(documents);
  } catch (error: any) {
    console.error('Error in GET /api/admin/documents:', error);

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
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

    const body = await request.json();

    const { data: document, error } = await supabaseAdmin
      .from('regulatory_documents')
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Error in POST /api/admin/documents:', error);

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
