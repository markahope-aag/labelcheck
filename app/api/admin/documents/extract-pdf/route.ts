import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, extractPDFMetadata, cleanExtractedText } from '@/lib/pdf-helpers';
import { requireAdmin } from '@/lib/auth-helpers';
import { logger, createRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/documents/extract-pdf' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

    // Get the uploaded PDF file
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    requestLogger.info('PDF extraction started', { fileName: file?.name, fileSize: file?.size });

    if (!file) {
      requestLogger.warn('PDF extraction request missing file');
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
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
  } catch (error: any) {
    requestLogger.error('PDF extraction failed', { error, message: error.message });

    // Handle auth errors with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Failed to process PDF' }, { status: 500 });
  }
}
