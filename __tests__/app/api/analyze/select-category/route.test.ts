/**
 * Tests for app/api/analyze/select-category/route.ts
 *
 * Tests the category selection endpoint
 */

import { POST } from '@/app/api/analyze/select-category/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

// Mock dependencies
// Clerk is mocked globally in jest.setup.js, but we need to re-import it to customize
jest.mock('@clerk/nextjs/server');

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

// Logger is mocked globally in jest.setup.js

describe('POST /api/analyze/select-category', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
          selectedCategory: 'CONVENTIONAL_FOOD',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_ERROR');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should return 500 if analysisId is missing (database error)', async () => {
      // Mock Supabase to return an error when no analysisId is provided
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: {
                  message: 'No rows found',
                  code: 'PGRST116',
                },
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          selectedCategory: 'CONVENTIONAL_FOOD',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });

    it('should return 400 if selectedCategory is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if selectedCategory is invalid', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
          selectedCategory: 'INVALID_CATEGORY',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid category');
    });
  });

  describe('Success Scenarios', () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should successfully update analysis category', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-analysis-id',
                  product_category: 'CONVENTIONAL_FOOD',
                  user_selected_category: 'CONVENTIONAL_FOOD',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
          selectedCategory: 'CONVENTIONAL_FOOD',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.analysis.product_category).toBe('CONVENTIONAL_FOOD');
    });

    it('should handle category selection reason', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'test-analysis-id',
                  product_category: 'DIETARY_SUPPLEMENT',
                  user_selected_category: 'DIETARY_SUPPLEMENT',
                  category_selection_reason: 'User clarified product type',
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
          selectedCategory: 'DIETARY_SUPPLEMENT',
          reason: 'User clarified product type',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should handle database errors', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: {
                  message: 'Database error',
                  code: 'PGRST116',
                },
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/select-category', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: 'test-analysis-id',
          selectedCategory: 'CONVENTIONAL_FOOD',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
