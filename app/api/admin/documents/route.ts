import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { data: documents, error } = await supabase
      .from('regulatory_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    return NextResponse.json(documents);
  } catch (error: any) {
    console.error('Error in GET /api/admin/documents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();

    // Only include fields that exist in the database schema
    const documentData: any = {
      title: body.title,
      content: body.content,
      document_type: body.document_type,
      is_active: body.is_active,
    };

    // Add optional fields only if they have values
    if (body.jurisdiction) documentData.jurisdiction = body.jurisdiction;
    if (body.source) documentData.source = body.source;
    if (body.effective_date) documentData.effective_date = body.effective_date;
    if (body.version) documentData.version = body.version;

    const { data: document, error } = await supabase
      .from('regulatory_documents')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    return NextResponse.json(document);
  } catch (error: any) {
    console.error('Error in POST /api/admin/documents:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
