import { NextRequest, NextResponse } from 'next/server';
import { analyzeImageQuality } from '@/lib/image-quality';

export async function POST(request: NextRequest) {
  try {
    const buffer = Buffer.from(await request.arrayBuffer());

    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Get original file size from buffer
    const fileSize = buffer.length;

    // Analyze image quality
    const metrics = await analyzeImageQuality(buffer, fileSize);

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Error checking image quality:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check image quality' },
      { status: 500 }
    );
  }
}
