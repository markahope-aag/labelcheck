import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  handleSupabaseError,
} from '@/lib/error-handler';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/[id]' });

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

    const body = await request.json();
    const { id } = params;

    requestLogger.info('Admin document update started');

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
      throw handleSupabaseError(error, 'update regulatory document');
    }

    if (!document) {
      throw new NotFoundError('Document', id);
    }

    requestLogger.info('Document updated successfully', {
      documentId: id,
      title: document?.title,
    });

    return NextResponse.json(document);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/[id]' });

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

    const { id } = params;

    requestLogger.info('Admin document deletion started');

    // Check if document exists before deleting
    const { data: existingDoc } = await supabaseAdmin
      .from('regulatory_documents')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingDoc) {
      throw new NotFoundError('Document', id);
    }

    // Actually delete the document from the database
    const { error } = await supabaseAdmin.from('regulatory_documents').delete().eq('id', id);

    if (error) {
      throw handleSupabaseError(error, 'delete regulatory document');
    }

    requestLogger.info('Document deleted successfully', { documentId: id });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
