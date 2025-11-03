/**
 * Tests for app/api/analyze/check-quality/route.ts
 *
 * Tests the image quality check endpoint
 */

import { POST } from '@/app/api/analyze/check-quality/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkImageQuality } from '@/lib/image-quality';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/image-quality');
jest.mock('@/lib/logger');

describe('POST /api/analyze/check-quality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_ERROR');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should return 400 if image is missing', async () => {
      const formData = new FormData();

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('image');
    });

    it('should return 400 if image buffer is empty', async () => {
      const formData = new FormData();
      formData.append('image', new File([], 'empty.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Image Quality Check', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should successfully check image quality', async () => {
      const mockQualityMetrics = {
        width: 2000,
        height: 1500,
        resolution: 300,
        fileSize: 500000,
        isHighQuality: true,
        warnings: [],
      };

      (checkImageQuality as jest.Mock).mockResolvedValue(mockQualityMetrics);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toEqual(mockQualityMetrics);
      expect(checkImageQuality).toHaveBeenCalled();
    });

    it('should return quality warnings for low-quality images', async () => {
      const mockQualityMetrics = {
        width: 500,
        height: 400,
        resolution: 72,
        fileSize: 10000,
        isHighQuality: false,
        warnings: ['Low resolution', 'Small dimensions'],
      };

      (checkImageQuality as jest.Mock).mockResolvedValue(mockQualityMetrics);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics.isHighQuality).toBe(false);
      expect(data.metrics.warnings).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
    });

    it('should handle image processing errors', async () => {
      (checkImageQuality as jest.Mock).mockRejectedValue(new Error('Failed to process image'));

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze/check-quality', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
