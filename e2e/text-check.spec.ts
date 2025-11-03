import { test, expect } from '@playwright/test';

test.describe('POST /api/analyze/text', () => {
  test('should reject requests without authentication', async ({ request }) => {
    const response = await request.post('/api/analyze/text', {
      data: JSON.stringify({
        analysisId: 'test-id',
        text: 'Sample ingredient list',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Clerk's auth.protect() returns 404 for unauthenticated API requests
    expect(response.status()).toBe(404);
  });

  test('should reject missing analysis ID', async ({ request }) => {
    const response = await request.post('/api/analyze/text', {
      data: JSON.stringify({
        text: 'Sample ingredient list',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject missing text content', async ({ request }) => {
    const response = await request.post('/api/analyze/text', {
      data: JSON.stringify({
        analysisId: 'test-id',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject empty text', async ({ request }) => {
    const response = await request.post('/api/analyze/text', {
      data: JSON.stringify({
        analysisId: 'test-id',
        text: '',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should validate PDF mode requirements', async ({ request }) => {
    const response = await request.post('/api/analyze/text', {
      data: JSON.stringify({
        analysisId: 'test-id',
        mode: 'pdf',
        // Missing pdfBase64
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });
});
