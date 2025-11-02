import sharp from 'sharp';

export interface ImageQualityMetrics {
  width: number;
  height: number;
  megapixels: number;
  fileSize: number;
  format: string;
  isBlurry: boolean;
  blurScore: number; // 0-100, lower = more blurry
  brightness: number; // 0-255 average
  contrast: number; // 0-100 estimate
  qualityScore: number; // 0-100 overall quality
  issues: ImageQualityIssue[];
  recommendation: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unusable';
}

export interface ImageQualityIssue {
  severity: 'critical' | 'warning' | 'info';
  type: 'resolution' | 'blur' | 'brightness' | 'contrast' | 'filesize';
  message: string;
  suggestion: string;
}

/**
 * Analyze image quality and return detailed metrics
 * @param buffer Image buffer to analyze
 * @param originalFileSize Original file size in bytes
 * @returns Image quality metrics and issues
 */
export async function analyzeImageQuality(
  buffer: Buffer,
  originalFileSize: number
): Promise<ImageQualityMetrics> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Could not read image dimensions');
  }

  const width = metadata.width;
  const height = metadata.height;
  const megapixels = (width * height) / 1_000_000;
  const format = metadata.format || 'unknown';

  // Get raw pixel data for analysis
  const { data, info } = await image
    .resize(Math.min(width, 1000), Math.min(height, 1000), {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Calculate brightness (average luminance)
  const brightness = calculateBrightness(data, info.channels);

  // Calculate contrast (standard deviation of luminance)
  const contrast = calculateContrast(data, info.channels, brightness);

  // Estimate blur using Laplacian variance (requires edge detection)
  const blurScore = await estimateBlur(buffer, width, height);
  const isBlurry = blurScore < 30; // Threshold for blur detection

  // Collect issues
  const issues: ImageQualityIssue[] = [];

  // Check resolution
  if (megapixels < 0.3) {
    // Less than 0.3MP (e.g., 640x480)
    issues.push({
      severity: 'critical',
      type: 'resolution',
      message: `Image resolution is too low (${width}x${height}, ${megapixels.toFixed(2)}MP)`,
      suggestion:
        'Use a higher resolution camera or take the photo closer to the label. Minimum recommended: 1MP (1280x720)',
    });
  } else if (megapixels < 1.0) {
    issues.push({
      severity: 'warning',
      type: 'resolution',
      message: `Image resolution is low (${width}x${height}, ${megapixels.toFixed(2)}MP)`,
      suggestion: 'For best results, use at least 2MP resolution (1920x1080 or higher)',
    });
  }

  // Check blur
  if (isBlurry) {
    if (blurScore < 15) {
      issues.push({
        severity: 'critical',
        type: 'blur',
        message: `Image is very blurry (blur score: ${blurScore.toFixed(0)}/100)`,
        suggestion:
          "Hold the camera steady, ensure good focus, and avoid movement. Use your phone's camera auto-focus feature.",
      });
    } else {
      issues.push({
        severity: 'warning',
        type: 'blur',
        message: `Image appears slightly blurry (blur score: ${blurScore.toFixed(0)}/100)`,
        suggestion: 'Try taking the photo again with better focus or in better lighting',
      });
    }
  }

  // Check brightness
  if (brightness < 40) {
    issues.push({
      severity: 'critical',
      type: 'brightness',
      message: `Image is too dark (brightness: ${brightness.toFixed(0)}/255)`,
      suggestion:
        'Take the photo in better lighting or increase exposure. Avoid shadows on the label.',
    });
  } else if (brightness > 215) {
    issues.push({
      severity: 'critical',
      type: 'brightness',
      message: `Image is overexposed (brightness: ${brightness.toFixed(0)}/255)`,
      suggestion:
        'Reduce exposure or avoid direct harsh lighting. The label text should be clearly visible.',
    });
  } else if (brightness < 70 || brightness > 185) {
    issues.push({
      severity: 'warning',
      type: 'brightness',
      message: `Image brightness is suboptimal (${brightness.toFixed(0)}/255)`,
      suggestion: brightness < 70 ? 'Use more lighting' : 'Reduce lighting or exposure',
    });
  }

  // Check contrast
  if (contrast < 15) {
    issues.push({
      severity: 'warning',
      type: 'contrast',
      message: `Image has low contrast (${contrast.toFixed(0)}/100)`,
      suggestion:
        'Ensure good lighting with minimal glare. The label text should stand out clearly from the background.',
    });
  }

  // Check file size
  const fileSizeMB = originalFileSize / (1024 * 1024);
  if (fileSizeMB > 10) {
    issues.push({
      severity: 'warning',
      type: 'filesize',
      message: `File size is large (${fileSizeMB.toFixed(1)}MB)`,
      suggestion: 'Consider compressing the image to improve upload speed',
    });
  }

  // Calculate overall quality score (0-100)
  let qualityScore = 100;

  // Resolution penalty
  if (megapixels < 0.3) qualityScore -= 40;
  else if (megapixels < 1.0) qualityScore -= 20;
  else if (megapixels < 2.0) qualityScore -= 10;

  // Blur penalty
  if (blurScore < 15) qualityScore -= 30;
  else if (blurScore < 30) qualityScore -= 15;
  else if (blurScore < 50) qualityScore -= 5;

  // Brightness penalty
  if (brightness < 40 || brightness > 215) qualityScore -= 25;
  else if (brightness < 70 || brightness > 185) qualityScore -= 10;

  // Contrast penalty
  if (contrast < 15) qualityScore -= 10;
  else if (contrast < 25) qualityScore -= 5;

  qualityScore = Math.max(0, qualityScore);

  // Determine recommendation
  let recommendation: ImageQualityMetrics['recommendation'];
  if (qualityScore >= 85) recommendation = 'excellent';
  else if (qualityScore >= 70) recommendation = 'good';
  else if (qualityScore >= 50) recommendation = 'acceptable';
  else if (qualityScore >= 30) recommendation = 'poor';
  else recommendation = 'unusable';

  return {
    width,
    height,
    megapixels,
    fileSize: originalFileSize,
    format,
    isBlurry,
    blurScore,
    brightness,
    contrast,
    qualityScore,
    issues,
    recommendation,
  };
}

/**
 * Calculate average brightness (luminance) of the image
 * @param data Raw pixel data
 * @param channels Number of color channels
 * @returns Average brightness (0-255)
 */
function calculateBrightness(data: Buffer, channels: number): number {
  let sum = 0;
  const pixelCount = data.length / channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert to grayscale using luminance formula
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += luminance;
  }

  return sum / pixelCount;
}

/**
 * Calculate contrast (standard deviation of luminance)
 * @param data Raw pixel data
 * @param channels Number of color channels
 * @param brightness Average brightness
 * @returns Contrast score (0-100)
 */
function calculateContrast(data: Buffer, channels: number, brightness: number): number {
  let sumSquaredDiff = 0;
  const pixelCount = data.length / channels;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    const diff = luminance - brightness;
    sumSquaredDiff += diff * diff;
  }

  const variance = sumSquaredDiff / pixelCount;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-100 scale (typical stdDev range is 0-70 for most images)
  return Math.min(100, (stdDev / 70) * 100);
}

/**
 * Estimate blur using Laplacian variance
 * Higher values = sharper image
 * Lower values = blurrier image
 * @param buffer Original image buffer
 * @param width Image width
 * @param height Image height
 * @returns Blur score (0-100, higher = sharper)
 */
async function estimateBlur(buffer: Buffer, width: number, height: number): Promise<number> {
  // Resize to reasonable size for blur detection (faster processing)
  const maxDimension = 500;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  // Convert to grayscale and get pixel data
  const { data } = await sharp(buffer)
    .resize(targetWidth, targetHeight, { fit: 'inside' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Apply Laplacian kernel (edge detection)
  // Laplacian kernel:
  // [ 0 -1  0 ]
  // [-1  4 -1 ]
  // [ 0 -1  0 ]

  let laplacianSum = 0;
  let count = 0;

  for (let y = 1; y < targetHeight - 1; y++) {
    for (let x = 1; x < targetWidth - 1; x++) {
      const idx = y * targetWidth + x;
      const center = data[idx];
      const top = data[(y - 1) * targetWidth + x];
      const bottom = data[(y + 1) * targetWidth + x];
      const left = data[y * targetWidth + (x - 1)];
      const right = data[y * targetWidth + (x + 1)];

      const laplacian = Math.abs(4 * center - top - bottom - left - right);
      laplacianSum += laplacian * laplacian; // Variance
      count++;
    }
  }

  const variance = laplacianSum / count;

  // Normalize to 0-100 scale
  // Typical sharp images have variance > 1000
  // Blurry images have variance < 100
  const blurScore = Math.min(100, (variance / 1000) * 100);

  return blurScore;
}

/**
 * Generate user-friendly quality message
 * @param metrics Image quality metrics
 * @returns User-friendly message
 */
export function getQualityMessage(metrics: ImageQualityMetrics): {
  title: string;
  description: string;
  canProceed: boolean;
} {
  const { recommendation, issues, qualityScore } = metrics;

  switch (recommendation) {
    case 'excellent':
      return {
        title: '✨ Excellent Image Quality',
        description: `This image is high quality (score: ${qualityScore}/100) and should produce accurate analysis results.`,
        canProceed: true,
      };

    case 'good':
      return {
        title: '✅ Good Image Quality',
        description: `This image quality is good (score: ${qualityScore}/100). Analysis should work well.`,
        canProceed: true,
      };

    case 'acceptable':
      return {
        title: '⚠️ Acceptable Image Quality',
        description: `This image quality is acceptable (score: ${qualityScore}/100), but ${issues.length} issue(s) detected. Analysis may have reduced accuracy.`,
        canProceed: true,
      };

    case 'poor':
      return {
        title: '❌ Poor Image Quality',
        description: `This image quality is poor (score: ${qualityScore}/100). ${issues.length} issue(s) detected. We recommend re-uploading a better image for accurate analysis.`,
        canProceed: true,
      };

    case 'unusable':
      return {
        title: '🚫 Unusable Image Quality',
        description: `This image quality is too poor for reliable analysis (score: ${qualityScore}/100). Please upload a clearer, higher quality image.`,
        canProceed: true, // Still allow but strongly discourage
      };

    default:
      return {
        title: 'Image Quality Unknown',
        description: 'Could not determine image quality',
        canProceed: true,
      };
  }
}
