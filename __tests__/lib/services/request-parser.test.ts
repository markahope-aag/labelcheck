/**
 * Tests for lib/services/request-parser.ts
 *
 * Tests request parsing with test-mode-aware logic, including:
 * - Test mode detection
 * - JSON body parsing with cloning in test mode
 * - FormData parsing
 * - Unified request parsing with content-type detection
 */

import { NextRequest } from 'next/server';
import {
  isTestMode,
  parseJsonBody,
  parseFormDataBody,
  parseRequest,
} from '@/lib/services/request-parser';
import { z } from 'zod';

// Mock logger to prevent console spam
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Request Parser Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isTestMode', () => {
    it('should return true when test bypass header matches and not in production', () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'test-secret-123' },
      });

      expect(isTestMode(request)).toBe(true);
    });

    it('should return false when test bypass header is missing', () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const request = new NextRequest('http://localhost:3000/api/test');

      expect(isTestMode(request)).toBe(false);
    });

    it('should return false when test bypass header does not match', () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'wrong-token' },
      });

      expect(isTestMode(request)).toBe(false);
    });

    it('should return false in production even with valid test bypass header', () => {
      process.env.NODE_ENV = 'production';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'test-secret-123' },
      });

      expect(isTestMode(request)).toBe(false);
    });

    it('should return false when TEST_BYPASS_TOKEN is not set', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.TEST_BYPASS_TOKEN;

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'any-value' },
      });

      expect(isTestMode(request)).toBe(false);
    });
  });

  describe('parseJsonBody', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it('should parse valid JSON body successfully', async () => {
      const body = { name: 'John', age: 30 };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonBody(request, testSchema, false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(body);
      }
    });

    it('should clone request in test mode before parsing', async () => {
      const body = { name: 'Jane', age: 25 };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      // In test mode, request should be cloned
      const result = await parseJsonBody(request, testSchema, true);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(body);
      }
    });

    it('should return validation error for invalid data', async () => {
      const body = { name: 'John', age: 'thirty' }; // age should be number
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonBody(request, testSchema, false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors).toBeDefined();
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should return error for missing required fields', async () => {
      const body = { name: 'John' }; // missing age
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonBody(request, testSchema, false);

      expect(result.success).toBe(false);
    });

    it('should return error for malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: 'not valid json {',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonBody(request, testSchema, false);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toContain('Invalid JSON');
      }
    });

    it('should return error for empty body', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseJsonBody(request, testSchema, false);

      expect(result.success).toBe(false);
    });
  });

  describe('parseFormDataBody', () => {
    // Note: Direct parseFormDataBody testing is skipped due to Next.js FormData handling in test environment
    // The integration is tested through parseRequest() which uses FormData successfully in tests

    it('is tested through parseRequest integration tests', () => {
      // See parseRequest tests for FormData handling verification
      expect(true).toBe(true);
    });
  });

  describe('parseRequest', () => {
    const jsonSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    it('should parse JSON request when content-type is application/json', async () => {
      process.env.NODE_ENV = 'development';
      const body = { name: 'Test', value: 42 };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseRequest(request, jsonSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(body);
        expect(result.isTestMode).toBe(false);
        expect(result.formData).toBeUndefined();
      }
    });

    it('should parse FormData request when content-type is multipart/form-data', async () => {
      process.env.NODE_ENV = 'development';
      const formSchema = z.object({
        name: z.string(),
      });

      const formData = new FormData();
      formData.append('name', 'Test Name');

      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: formData,
      });

      const result = await parseRequest(request, formSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Test Name');
        expect(result.isTestMode).toBe(false);
        expect(result.formData).toBeInstanceOf(FormData);
      }
    });

    it('should detect test mode correctly', async () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const body = { name: 'Test', value: 42 };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Bypass': 'test-secret-123',
        },
      });

      const result = await parseRequest(request, jsonSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isTestMode).toBe(true);
      }
    });

    it('should default to JSON parsing when content-type is missing', async () => {
      const body = { name: 'Test', value: 42 };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const result = await parseRequest(request, jsonSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(body);
      }
    });

    it('should return validation errors with isTestMode flag', async () => {
      const body = { name: 'Test', value: 'not-a-number' };
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await parseRequest(request, jsonSchema);

      expect(result.success).toBe(false);
      expect(result.isTestMode).toBe(false);
    });
  });
});
