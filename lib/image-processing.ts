import sharp from 'sharp';

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

    // Upscale if image is too small (min 1500px on longest side for better text recognition)
    const longestSide = Math.max(width, height);
    if (longestSide < 1500) {
      const scaleFactor = 1500 / longestSide;
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
        sigma: 1.5,
        m1: 1.0,
        m2: 0.7,
        x1: 3,
        y2: 15,
      })
      // Enhance contrast
      .linear(1.2, -(128 * 1.2) + 128);

    // Convert to JPEG with high quality
    const processedBuffer = await processedImage
      .jpeg({
        quality: 95,
        chromaSubsampling: '4:4:4',
      })
      .toBuffer();

    return processedBuffer;
  } catch (error) {
    console.error('Error preprocessing image:', error);
    // If preprocessing fails, return original buffer
    return buffer;
  }
}

/**
 * Validates image dimensions and file size
 */
export function validateImageSize(buffer: Buffer, maxSizeMB: number = 10): boolean {
  const sizeMB = buffer.length / (1024 * 1024);
  return sizeMB <= maxSizeMB;
}
