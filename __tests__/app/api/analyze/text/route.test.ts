/**
 * Tests for app/api/analyze/text/route.ts
 *
 * Tests the text-based analysis endpoint (PDF upload and direct text input)
 */

import { POST } from '@/app/api/analyze/text/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase');
jest.mock('@/lib/session-helpers');
jest.mock('@/lib/regulatory-documents');
jest.mock('@/lib/pdf-helpers');
jest.mock('@/lib/logger');
jest.mock('openai');

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

describe('POST /api/analyze/text', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          text: 'Product label text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_ERROR');
    });
  });

  describe('Text Mode (JSON)', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-internal-id', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      });
    });

    it('should return 400 if text is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if text is too long', async () => {
      const longText = 'x'.repeat(50001); // Exceeds TEXT_LIMITS.STORED_TEXT_LENGTH

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          text: longText,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully process text input', async () => {
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'user-internal-id' },
        iterations: [],
        error: null,
      });

      (getActiveRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (buildRegulatoryContext as jest.Mock).mockReturnValue('Regulatory context');

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: {
                  primary_compliance_status: 'compliant',
                },
              }),
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        result_data: {
          product_category: 'CONVENTIONAL_FOOD',
          overall_assessment: {
            primary_compliance_status: 'compliant',
          },
        },
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          text: 'Product label text content',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });
  });

  describe('PDF Mode (FormData)', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-internal-id', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      });
    });

    it('should return 400 if PDF is missing', async () => {
      const formData = new FormData();
      formData.append('sessionId', 'test-session-id');

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if PDF is not a valid PDF file', async () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('sessionId', 'test-session-id');
      formData.append('pdf', invalidFile);

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully process PDF upload', async () => {
      const pdfFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'user-internal-id' },
        iterations: [],
        error: null,
      });

      (processPdfForAnalysis as jest.Mock).mockResolvedValue({
        textContent: 'Extracted PDF text content',
        success: true,
      });

      (getActiveRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (buildRegulatoryContext as jest.Mock).mockReturnValue('Regulatory context');

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: {
                  primary_compliance_status: 'compliant',
                },
              }),
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        result_data: {
          product_category: 'CONVENTIONAL_FOOD',
          overall_assessment: {
            primary_compliance_status: 'compliant',
          },
        },
      });

      const formData = new FormData();
      formData.append('sessionId', 'test-session-id');
      formData.append('pdf', pdfFile);

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(processPdfForAnalysis).toHaveBeenCalledWith(pdfFile);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should handle PDF extraction errors', async () => {
      const pdfFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });

      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'user-internal-id' },
        iterations: [],
        error: null,
      });

      (processPdfForAnalysis as jest.Mock).mockResolvedValue({
        textContent: null,
        success: false,
        error: 'Failed to extract text from PDF',
      });

      const formData = new FormData();
      formData.append('sessionId', 'test-session-id');
      formData.append('pdf', pdfFile);

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('PDF');
    });
  });

  describe('Session Handling', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-internal-id', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      });
    });

    it('should return 404 if session does not exist', async () => {
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: null,
        iterations: [],
        error: new Error('Session not found'),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'non-existent-session-id',
          text: 'Product label text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should verify session belongs to user', async () => {
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'different-user-id' },
        iterations: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          text: 'Product label text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: 'user-internal-id', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      });
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'user-internal-id' },
        iterations: [],
        error: null,
      });
      (getActiveRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (buildRegulatoryContext as jest.Mock).mockReturnValue('');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          text: 'Product label text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
    });

    it('should handle database errors when saving iteration', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: {
                  primary_compliance_status: 'compliant',
                },
              }),
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/analyze/text', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          text: 'Product label text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
