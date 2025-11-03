/**
 * Tests for lib/validation.ts
 *
 * Tests Zod validation schemas for type-safe API request validation
 */

import {
  analyzeRequestSchema,
  chatRequestSchema,
  textCheckerTextSchema,
  textCheckerPdfSchema,
  shareRequestSchema,
  formatValidationErrors,
  createValidationErrorResponse,
} from '@/lib/validation';
import { z } from 'zod';

describe('Validation Schemas', () => {
  describe('analyzeRequestSchema', () => {
    it('should validate valid analyze request with all fields', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 }); // 1MB

      const validData = {
        image: mockFile,
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        labelName: 'Test Label',
        forcedCategory: 'CONVENTIONAL_FOOD' as const,
      };

      const result = analyzeRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.image).toBe(mockFile);
        expect(result.data.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.labelName).toBe('Test Label');
        expect(result.data.forcedCategory).toBe('CONVENTIONAL_FOOD');
      }
    });

    it('should validate analyze request without optional fields', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

      const validData = {
        image: mockFile,
      };

      const result = analyzeRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject analyze request with invalid UUID sessionId', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

      const invalidData = {
        image: mockFile,
        sessionId: 'not-a-uuid',
      };

      const result = analyzeRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('session ID');
      }
    });

    it('should reject analyze request with label name over 200 characters', () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      Object.defineProperty(mockFile, 'size', { value: 1024 * 1024 });

      const invalidData = {
        image: mockFile,
        labelName: 'a'.repeat(201),
      };

      const result = analyzeRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('200 characters');
      }
    });
  });

  describe('chatRequestSchema', () => {
    it('should validate valid chat request', () => {
      const validData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        question: 'What does this label say?',
      };

      const result = chatRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000');
        expect(result.data.question).toBe('What does this label say?');
      }
    });

    it('should reject chat request with missing question', () => {
      const invalidData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        question: '',
      };

      const result = chatRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('required');
      }
    });

    it('should reject chat request with question over 1000 characters', () => {
      const invalidData = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        question: 'a'.repeat(1001),
      };

      const result = chatRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('1000 characters');
      }
    });

    it('should reject chat request with invalid UUID sessionId', () => {
      const invalidData = {
        sessionId: 'not-a-uuid',
        question: 'What does this label say?',
      };

      const result = chatRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('UUID');
      }
    });
  });

  describe('textCheckerTextSchema', () => {
    it('should validate valid text checker request', () => {
      const validData = {
        text: 'Ingredients: Water, Sugar, Salt',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = textCheckerTextSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.text).toBe('Ingredients: Water, Sugar, Salt');
        expect(result.data.sessionId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should reject text under 10 characters', () => {
      const invalidData = {
        text: 'short',
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = textCheckerTextSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('10 characters');
      }
    });

    it('should reject text over 10,000 characters', () => {
      const invalidData = {
        text: 'a'.repeat(10001),
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = textCheckerTextSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('10,000 characters');
      }
    });
  });

  describe('shareRequestSchema', () => {
    it('should validate valid share request', () => {
      const validData = {
        analysisId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = shareRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.analysisId).toBe('123e4567-e89b-12d3-a456-426614174000');
      }
    });

    it('should reject share request with invalid UUID', () => {
      const invalidData = {
        analysisId: 'not-a-uuid',
      };

      const result = shareRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('UUID');
      }
    });
  });

  describe('formatValidationErrors', () => {
    it('should format validation errors into user-friendly messages', () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const result = schema.safeParse({ email: 'invalid', age: 10 });
      expect(result.success).toBe(false);

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);
        expect(formatted).toHaveLength(2);
        expect(formatted[0]).toContain('email');
        expect(formatted[1]).toContain('age');
      }
    });

    it('should handle nested field errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string().min(1),
        }),
      });

      const result = schema.safeParse({ user: { name: '' } });
      expect(result.success).toBe(false);

      if (!result.success) {
        const formatted = formatValidationErrors(result.error);
        expect(formatted[0]).toContain('user.name');
      }
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create standardized error response', () => {
      const schema = z.object({
        email: z.string().email(),
      });

      const result = schema.safeParse({ email: 'invalid' });
      expect(result.success).toBe(false);

      if (!result.success) {
        const response = createValidationErrorResponse(result.error);

        expect(response).toHaveProperty('error', 'Validation failed');
        expect(response).toHaveProperty('code', 'VALIDATION_ERROR');
        expect(response).toHaveProperty('details');
        expect(response).toHaveProperty('fields');

        expect(response.details).toBeInstanceOf(Array);
        expect(response.fields).toBeInstanceOf(Array);
        expect(response.fields[0]).toHaveProperty('field');
        expect(response.fields[0]).toHaveProperty('message');
      }
    });
  });
});
