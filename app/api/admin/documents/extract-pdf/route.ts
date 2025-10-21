import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF, extractPDFMetadata, cleanExtractedText } from '@/lib/pdf-helpers';

export const dynamic = 'force-dynamic';

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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get the uploaded PDF file
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
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
    console.error('Error in POST /api/admin/documents/extract-pdf:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process PDF' },
      { status: 500 }
    );
  }
}
