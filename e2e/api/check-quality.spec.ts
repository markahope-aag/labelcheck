/**
 * E2E Tests for /api/analyze/check-quality
 *
 * Tests the image quality check endpoint with real HTTP requests
 */

import { test, expect } from '@playwright/test';
import sharp from 'sharp';

// Helper to create a real tiny JPEG buffer (10x10 pixels) for testing
async function createTestImage(): Promise<Buffer> {
  // Create a real tiny JPEG using sharp - this will have actual dimensions
  const image = sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  });

  return await image.jpeg({ quality: 80 }).toBuffer();
}

test.describe('POST /api/analyze/check-quality', () => {
  test('should return 400 if image buffer is empty', async ({ request }) => {
    const response = await request.post('/api/analyze/check-quality', {
      data: Buffer.alloc(0), // Empty buffer
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
    expect(data.error).toContain('Image is required');
  });

  test('should successfully check image quality', async ({ request }) => {
    const imageBuffer = await createTestImage();

    const response = await request.post('/api/analyze/check-quality', {
      data: imageBuffer,
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('width');
    expect(data).toHaveProperty('height');
    expect(data).toHaveProperty('fileSize');
    expect(data).toHaveProperty('recommendation');
    expect(data).toHaveProperty('issues');

    // Validate types
    expect(typeof data.width).toBe('number');
    expect(typeof data.height).toBe('number');
    expect(typeof data.fileSize).toBe('number');
    expect(typeof data.recommendation).toBe('string');
    expect(Array.isArray(data.issues)).toBe(true);
  });

  test('should return quality warnings for small images', async ({ request }) => {
    // Use a real tiny JPEG (10x10 pixels) which will be flagged as low quality
    const imageBuffer = await createTestImage();

    const response = await request.post('/api/analyze/check-quality', {
      data: imageBuffer,
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Small test image (10x10) should be flagged as unusable/low quality
    expect(['poor', 'unusable']).toContain(data.recommendation);
    expect(data.issues.length).toBeGreaterThan(0);
  });

  test('should handle invalid image data', async ({ request }) => {
    // Send invalid image data (not a real image)
    const invalidBuffer = Buffer.from('not an image');

    const response = await request.post('/api/analyze/check-quality', {
      data: invalidBuffer,
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    // Should either return error or handle gracefully
    // The actual behavior depends on the image-quality library
    expect([400, 500]).toContain(response.status());
  });
});
