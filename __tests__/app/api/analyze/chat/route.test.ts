/**
 * Tests for app/api/analyze/chat/route.ts
 *
 * Tests the chat functionality for asking questions about analysis results
 */

import { POST } from '@/app/api/analyze/chat/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase');
jest.mock('@/lib/session-helpers');
jest.mock('@/lib/regulatory-documents');
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

describe('POST /api/analyze/chat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_ERROR');
    });

    it('should proceed when user is authenticated', async () => {
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

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Yes, this product is compliant.',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        response: 'Yes, this product is compliant.',
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Input Validation', () => {
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

    it('should return 400 if sessionId is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 if question is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
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

    it('should return 400 if sessionId is not a valid UUID', async () => {
      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'invalid-uuid',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Session Access Control', () => {
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

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'non-existent-session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should return 403 if session belongs to different user', async () => {
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'different-user-id' },
        iterations: [],
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
    });

    it('should proceed when session belongs to user', async () => {
      (getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: { id: 'session-id', user_id: 'user-internal-id' },
        iterations: [
          {
            id: 'iteration-1',
            input_type: 'image',
            result_data: {
              product_category: 'CONVENTIONAL_FOOD',
              overall_assessment: {
                primary_compliance_status: 'compliant',
              },
            },
          },
        ],
        error: null,
      });

      (getActiveRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (buildRegulatoryContext as jest.Mock).mockReturnValue('');

      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Yes, this product is compliant.',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        response: 'Yes, this product is compliant.',
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Chat Functionality', () => {
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
        iterations: [
          {
            id: 'iteration-1',
            input_type: 'image',
            result_data: {
              product_category: 'CONVENTIONAL_FOOD',
              overall_assessment: {
                primary_compliance_status: 'compliant',
              },
            },
          },
        ],
        error: null,
      });
      (getActiveRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (buildRegulatoryContext as jest.Mock).mockReturnValue('Regulatory context');
    });

    it('should successfully generate chat response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'This product is compliant with FDA regulations.',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        response: 'This product is compliant with FDA regulations.',
        timestamp: new Date().toISOString(),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this product compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.response).toBe('This product is compliant with FDA regulations.');
      expect(data.timestamp).toBeDefined();
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      expect(addIteration).toHaveBeenCalled();
    });

    it('should include session context in OpenAI call', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        response: 'Response',
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'What ingredients are problematic?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      await POST(request);

      // Verify OpenAI was called with context
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages).toBeDefined();
      expect(callArgs.messages.some((msg: any) => msg.role === 'user')).toBe(true);
    });

    it('should handle parent iteration ID for threaded conversations', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Follow-up response',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockResolvedValue({
        id: 'iteration-id',
        response: 'Follow-up response',
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Can you clarify?',
          parentIterationId: 'parent-iteration-id',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(addIteration).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          parentIterationId: 'parent-iteration-id',
        })
      );
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

    it('should return 404 if user not found', async () => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should handle database errors when saving iteration', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
      });

      (addIteration as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/analyze/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-id',
          question: 'Is this compliant?',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });
});
