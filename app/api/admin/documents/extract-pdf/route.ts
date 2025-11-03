import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { extractTextFromPDF, extractPDFMetadata, cleanExtractedText } from '@/lib/pdf-helpers';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from '@/lib/error-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/extract-pdf' });

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

    // Get the uploaded PDF file
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    requestLogger.info('PDF extraction started', { fileName: file?.name, fileSize: file?.size });

    if (!file) {
      throw new ValidationError('PDF data is required', { field: 'pdf' });
    }

    if (file.type !== 'application/pdf') {
      throw new ValidationError('File must be a PDF', { field: 'pdf', actualType: file.type });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text and metadata from PDF
    const [rawText, metadata] = await Promise.all([
      extractTextFromPDF(buffer),
      extractPDFMetadata(buffer),
    ]);

    // Clean the extracted text
    const cleanedText = cleanExtractedText(rawText);

    requestLogger.info('PDF extraction completed', {
      fileName: file.name,
      textLength: cleanedText.length,
      pages: metadata.pages,
    });

    return NextResponse.json({
      text: cleanedText,
      metadata: {
        pages: metadata.pages,
        title: metadata.title,
        author: metadata.author,
        subject: metadata.subject,
        creator: metadata.creator,
      },
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
