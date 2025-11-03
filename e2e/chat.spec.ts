import { test, expect } from '@playwright/test';

test.describe('POST /api/analyze/chat', () => {
  test('should reject requests without authentication', async ({ request }) => {
    const response = await request.post('/api/analyze/chat', {
      data: JSON.stringify({
        analysisId: 'test-id',
        message: 'What are the compliance issues?',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Clerk's auth.protect() returns 404 for unauthenticated API requests
    expect(response.status()).toBe(404);
  });

  test('should reject missing analysis ID', async ({ request }) => {
    const response = await request.post('/api/analyze/chat', {
      data: JSON.stringify({
        message: 'What are the compliance issues?',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('should reject missing message', async ({ request }) => {
    const response = await request.post('/api/analyze/chat', {
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

  test('should reject empty message', async ({ request }) => {
    const response = await request.post('/api/analyze/chat', {
      data: JSON.stringify({
        analysisId: 'test-id',
        message: '',
      }),
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Bypass': 'test-secret-token-12345',
      },
    });

    expect(response.status()).toBe(400);
  });
});
