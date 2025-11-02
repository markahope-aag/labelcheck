import sharp from 'sharp';
import { IMAGE_CONSTRAINTS, IMAGE_ENHANCEMENT } from '@/lib/constants';
import { logger } from '@/lib/logger';

/**
 * Preprocesses an image to improve readability for AI analysis
 * - Auto-rotates based on EXIF orientation
 * - Enhances contrast and sharpness
 * - Ensures minimum resolution
 * - Converts to optimal format
 */
export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // Start with the base image and auto-rotate based on EXIF
    let processedImage = image.rotate();

    // Get current dimensions
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;

    // Upscale if image is too small (min dimension from constants)
    const longestSide = Math.max(width, height);
    if (longestSide < IMAGE_CONSTRAINTS.MIN_DIMENSION_PX) {
      const scaleFactor = IMAGE_CONSTRAINTS.MIN_DIMENSION_PX / longestSide;
      processedImage = processedImage.resize({
        width: Math.round(width * scaleFactor),
        height: Math.round(height * scaleFactor),
        kernel: sharp.kernel.lanczos3,
        fit: 'inside',
      });
    }

    // Apply image enhancements for better text readability
    processedImage = processedImage
      // Normalize to improve contrast
      .normalize()
      // Sharpen to make text clearer
      .sharpen({
        sigma: IMAGE_ENHANCEMENT.SHARPEN_SIGMA,
        m1: IMAGE_ENHANCEMENT.SHARPEN_M1,
        m2: IMAGE_ENHANCEMENT.SHARPEN_M2,
        x1: IMAGE_ENHANCEMENT.SHARPEN_X1,
        y2: IMAGE_ENHANCEMENT.SHARPEN_Y2,
      })
      // Enhance contrast
      .linear(
        IMAGE_ENHANCEMENT.CONTRAST_MULTIPLIER,
        -(128 * IMAGE_ENHANCEMENT.CONTRAST_MULTIPLIER) + 128
      );

    // Convert to JPEG with high quality
    const processedBuffer = await processedImage
      .jpeg({
        quality: IMAGE_CONSTRAINTS.JPEG_QUALITY,
        chromaSubsampling: IMAGE_ENHANCEMENT.CHROMA_SUBSAMPLING,
      })
      .toBuffer();

    return processedBuffer;
  } catch (error) {
    logger.error('Image preprocessing failed', { error, bufferSize: buffer.length });
    // If preprocessing fails, return original buffer
    return buffer;
  }
}

/**
 * Validates image dimensions and file size
 */
export function validateImageSize(
  buffer: Buffer,
  maxSizeMB: number = IMAGE_CONSTRAINTS.MAX_FILE_SIZE_MB
): boolean {
  const sizeMB = buffer.length / (1024 * 1024);
  return sizeMB <= maxSizeMB;
}
