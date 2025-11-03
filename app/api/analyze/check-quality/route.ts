import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageQuality } from '@/lib/image-quality';
import { logger, createRequestLogger } from '@/lib/logger';
import { handleApiError, ValidationError, AuthenticationError } from '@/lib/error-handler';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/check-quality' });

  try {
    const buffer = Buffer.from(await request.arrayBuffer());
    requestLogger.debug('Image quality check started', { bufferSize: buffer.length });

    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Image is required', { field: 'image' });
    }

    // Get original file size from buffer
    const fileSize = buffer.length;

    // Analyze image quality
    const metrics = await analyzeImageQuality(buffer, fileSize);

    requestLogger.debug('Image quality check completed', { metrics });
    return NextResponse.json(metrics);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
