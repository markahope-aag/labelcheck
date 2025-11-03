/**
 * Tests for app/api/analyze/route.ts
 *
 * Tests the main analysis endpoint including:
 * - Authentication checks
 * - Input validation
 * - Usage limits
 * - File processing
 * - Error handling
 */

import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getUserWithFallback,
  checkUsageLimits,
  handleSession,
  processFile,
  extractTextForRag,
  loadRegulatoryDocuments,
  callAIWithRetry,
  saveAnalysis,
  updateUsage,
  sendNotificationEmail,
} from '@/lib/analysis/orchestrator';

// Mock dependencies - must be at top level
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/analysis/orchestrator', () => ({
  getUserWithFallback: jest.fn(),
  checkUsageLimits: jest.fn(),
  handleSession: jest.fn(),
  processFile: jest.fn(),
  extractTextForRag: jest.fn(),
  loadRegulatoryDocuments: jest.fn(),
  callAIWithRetry: jest.fn(),
  saveAnalysis: jest.fn(),
  updateUsage: jest.fn(),
  sendNotificationEmail: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.code).toBe('AUTH_ERROR');
      expect(data.error).toContain('Authentication required');
    });

    it('should proceed when user is authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });

      // Mock user lookup
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });

      // Mock usage check
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 5,
        monthly_limit: 100,
      });

      // Mock session handling
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id', user_id: 'user-internal-id' },
      });

      // Mock file processing
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });

      // Mock other dependencies
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });

      (saveAnalysis as jest.Mock).mockResolvedValue({
        id: 'analysis-id',
        compliance_status: 'compliant',
      });

      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(getUserWithFallback).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 5,
        monthly_limit: 100,
      });
    });

    it('should return 400 if image is missing', async () => {
      const formData = new FormData();

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('image');
    });

    it('should return 400 if file is too large', async () => {
      // Create a file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', {
        type: 'image/jpeg',
      });

      const formData = new FormData();
      formData.append('image', largeFile);

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
      expect(data.error).toContain('too large');
    });

    it('should return 400 if file type is invalid', async () => {
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('image', invalidFile);

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('should accept valid image file', async () => {
      const validFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      // Mock successful processing
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });
      (saveAnalysis as jest.Mock).mockResolvedValue({
        id: 'analysis-id',
        compliance_status: 'compliant',
      });
      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('image', validFile);

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Usage Limits', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });
    });

    it('should return 429 if usage limit is exceeded', async () => {
      (checkUsageLimits as jest.Mock).mockRejectedValue(
        new Error('Monthly limit reached: 100/100 analyses used')
      );

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.code).toBe('RATE_LIMIT');
      expect(data.error).toContain('limit reached');
    });

    it('should proceed when usage is within limits', async () => {
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 50,
        monthly_limit: 100,
      });

      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });
      (saveAnalysis as jest.Mock).mockResolvedValue({
        id: 'analysis-id',
        compliance_status: 'compliant',
      });
      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(checkUsageLimits).toHaveBeenCalledWith('test-user-id', 'user-internal-id');
    });
  });

  describe('Success Scenarios', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 5,
        monthly_limit: 100,
      });
    });

    it('should successfully process image analysis', async () => {
      const mockAnalysisResult = {
        id: 'analysis-id',
        image_name: 'test.jpg',
        compliance_status: 'compliant',
        issues_found: 0,
        created_at: new Date().toISOString(),
        analysis_result: {
          product_category: 'CONVENTIONAL_FOOD',
          overall_assessment: {
            primary_compliance_status: 'compliant',
            summary: 'Product is compliant',
          },
        },
      };

      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id', user_id: 'user-internal-id' },
      });

      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });

      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);

      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);

      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockAnalysisResult.analysis_result),
            },
          },
        ],
      });

      (saveAnalysis as jest.Mock).mockResolvedValue(mockAnalysisResult);
      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('analysis-id');
      expect(data.compliance_status).toBe('compliant');
      expect(saveAnalysis).toHaveBeenCalled();
      expect(updateUsage).toHaveBeenCalled();
    });

    it('should handle PDF files', async () => {
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });

      (processFile as jest.Mock).mockResolvedValue({
        isPdf: true,
        base64Data: undefined,
        pdfTextContent: 'PDF text content',
        mediaType: 'application/pdf' as const,
      });

      (extractTextForRag as jest.Mock).mockResolvedValue('extracted text');
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });

      (saveAnalysis as jest.Mock).mockResolvedValue({
        id: 'analysis-id',
        compliance_status: 'compliant',
      });
      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.pdf', { type: 'application/pdf' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(processFile).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 5,
        monthly_limit: 100,
      });
    });

    it('should handle OpenAI API errors', async () => {
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);

      // Mock OpenAI error
      (callAIWithRetry as jest.Mock).mockRejectedValue(
        new Error('OpenAI API error: Rate limit exceeded')
      );

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.code).toBe('EXTERNAL_SERVICE_ERROR');
    });

    it('should handle database errors', async () => {
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });

      // Mock database error
      (saveAnalysis as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
    });
  });

  describe('Optional Parameters', () => {
    beforeEach(() => {
      (auth as jest.Mock).mockResolvedValue({ userId: 'test-user-id' });
      (getUserWithFallback as jest.Mock).mockResolvedValue({
        id: 'user-internal-id',
        email: 'test@example.com',
      });
      (checkUsageLimits as jest.Mock).mockResolvedValue({
        analyses_this_month: 5,
        monthly_limit: 100,
      });
      (handleSession as jest.Mock).mockResolvedValue({
        sessionId: 'session-id',
        session: { id: 'session-id' },
      });
      (processFile as jest.Mock).mockResolvedValue({
        isPdf: false,
        base64Data: 'base64data',
        pdfTextContent: undefined,
        mediaType: 'image/jpeg' as const,
      });
      (extractTextForRag as jest.Mock).mockResolvedValue(undefined);
      (loadRegulatoryDocuments as jest.Mock).mockResolvedValue([]);
      (callAIWithRetry as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                product_category: 'CONVENTIONAL_FOOD',
                overall_assessment: { primary_compliance_status: 'compliant' },
              }),
            },
          },
        ],
      });
      (saveAnalysis as jest.Mock).mockResolvedValue({
        id: 'analysis-id',
        compliance_status: 'compliant',
      });
      (updateUsage as jest.Mock).mockResolvedValue(undefined);
      (sendNotificationEmail as jest.Mock).mockResolvedValue(undefined);
    });

    it('should handle existing sessionId', async () => {
      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
      formData.append('sessionId', 'existing-session-id');

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(handleSession).toHaveBeenCalledWith(
        'user-internal-id',
        'existing-session-id',
        expect.any(File)
      );
    });

    it('should handle labelName', async () => {
      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
      formData.append('labelName', 'My Product Label');

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // labelName should be passed to saveAnalysis
      expect(saveAnalysis).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'My Product Label',
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });

    it('should handle forcedCategory', async () => {
      const formData = new FormData();
      formData.append('image', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));
      formData.append('forcedCategory', 'DIETARY_SUPPLEMENT');

      const request = new NextRequest('http://localhost:3000/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // forcedCategory should be passed through the analysis flow
    });
  });
});
