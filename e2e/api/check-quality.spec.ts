/**
 * E2E Tests for /api/analyze/check-quality
 *
 * Tests the image quality check endpoint with real HTTP requests
 */

import { test, expect } from '@playwright/test';

// Helper to create a minimal valid JPEG buffer
function createTestImage(): Buffer {
  // Minimal JPEG header
  const jpegHeader = Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xe0, // SOI + APP0
    0x00,
    0x10, // APP0 length
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00, // "JFIF\0"
    0x01,
    0x01, // Version 1.1
    0x00,
    0x00,
    0x01,
    0x00,
    0x01, // No units, 1x1 aspect ratio
    0x00,
    0x00, // No thumbnail
    0xff,
    0xd9, // EOI
  ]);

  return jpegHeader;
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
    const imageBuffer = createTestImage();

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
    expect(data).toHaveProperty('isHighQuality');
    expect(data).toHaveProperty('warnings');

    // Validate types
    expect(typeof data.width).toBe('number');
    expect(typeof data.height).toBe('number');
    expect(typeof data.fileSize).toBe('number');
    expect(typeof data.isHighQuality).toBe('boolean');
    expect(Array.isArray(data.warnings)).toBe(true);
  });

  test('should return quality warnings for small images', async ({ request }) => {
    // Use the minimal JPEG which will be flagged as low quality
    const imageBuffer = createTestImage();

    const response = await request.post('/api/analyze/check-quality', {
      data: imageBuffer,
      headers: {
        'Content-Type': 'image/jpeg',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Small test image should be flagged as low quality
    expect(data.isHighQuality).toBe(false);
    expect(data.warnings.length).toBeGreaterThan(0);
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
