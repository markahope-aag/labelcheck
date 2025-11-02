import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageQuality } from '@/lib/image-quality';
import { logger, createRequestLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/check-quality' });

  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    requestLogger.debug('Image quality check started', { bufferSize: buffer.length });

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Get original file size from buffer
    const fileSize = buffer.length;

    // Analyze image quality
    const metrics = await analyzeImageQuality(buffer, fileSize);

    requestLogger.debug('Image quality check completed', { metrics });
    return NextResponse.json(metrics);
  } catch (error: any) {
    requestLogger.error('Image quality check failed', { error, message: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to check image quality' },
      { status: 500 }
    );
  }
}
