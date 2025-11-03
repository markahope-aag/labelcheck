import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  handleSupabaseError,
} from '@/lib/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents' });

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

    requestLogger.info('Admin documents fetch started');

    // Admin routes should use supabaseAdmin to bypass RLS
    const { data: documents, error } = await supabaseAdmin
      .from('regulatory_documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw handleSupabaseError(error, 'fetch documents');
    }

    requestLogger.debug('Documents fetched successfully', {
      count: documents?.length,
      columns: documents && documents.length > 0 ? Object.keys(documents[0]) : [],
    });

    return NextResponse.json(documents);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents' });

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

    requestLogger.info('Admin document creation started');

    const body = await request.json();

    if (!body.title) {
      throw new ValidationError('Title is required', { field: 'title' });
    }

    if (!body.content) {
      throw new ValidationError('Content is required', { field: 'content' });
    }

    const { data: document, error } = await supabaseAdmin
      .from('regulatory_documents')
      .insert(body)
      .select()
      .single();

    if (error) {
      throw handleSupabaseError(error, 'create regulatory document');
    }

    requestLogger.info('Document created successfully', {
      documentId: document?.id,
      title: document?.title,
    });

    return NextResponse.json(document);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
