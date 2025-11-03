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

test.describe('POST /api/analyze', () => {
  test('should reject requests without test bypass', async ({ request }) => {
    const imageBuffer = createTestImage();
    const base64Image = imageBuffer.toString('base64');

    const response = await request.post('/api/analyze', {
      data: JSON.stringify({
        image: `data:image/jpeg;base64,${base64Image}`,
        productType: 'CONVENTIONAL_FOOD',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Clerk's auth.protect() returns 404 for unauthenticated API requests
    expect(response.status()).toBe(404);
  });

  test('should reject invalid product types', async ({ request }) => {
    const imageBuffer = createTestImage();
    const base64Image = imageBuffer.toString('base64');

    const response = await request.post('/api/analyze', {
      data: JSON.stringify({
        image: `data:image/jpeg;base64,${base64Image}`,
        productType: 'INVALID_TYPE',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject missing image data', async ({ request }) => {
    const response = await request.post('/api/analyze', {
      data: JSON.stringify({
        productType: 'CONVENTIONAL_FOOD',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject missing product type', async ({ request }) => {
    const imageBuffer = createTestImage();
    const base64Image = imageBuffer.toString('base64');

    const response = await request.post('/api/analyze', {
      data: JSON.stringify({
        image: `data:image/jpeg;base64,${base64Image}`,
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });
});
