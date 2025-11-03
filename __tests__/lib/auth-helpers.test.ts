/**
 * Tests for lib/auth-helpers.ts
 *
 * Tests authentication helpers with test-mode-aware logic:
 * - authenticateRequest with test mode skip
 * - getAuthenticatedUser
 * - User lookup and error handling
 */

import { NextRequest } from 'next/server';
import { authenticateRequest, getAuthenticatedUser } from '@/lib/auth-helpers';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

// Mock dependencies
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Auth Helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('authenticateRequest', () => {
    const mockUser = {
      id: 'internal-user-123',
      clerk_user_id: 'clerk-user-123',
      email: 'test@example.com',
    };

    beforeEach(() => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });
    });

    it('should authenticate successfully in normal mode', async () => {
      process.env.NODE_ENV = 'development';
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });

      const request = new NextRequest('http://localhost:3000/api/test');
      const result = await authenticateRequest(request, false);

      expect(result.userId).toBe('clerk-user-123');
      expect(result.userInternalId).toBe('internal-user-123');
      expect(result.userEmail).toBe('test@example.com');
      expect(result.isTestMode).toBe(false);
      expect(result.shouldSkipAuth).toBe(false);
    });

    it('should skip authentication in test mode when skipAuthInTestMode is true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'test-secret-123' },
      });

      const result = await authenticateRequest(request, true);

      expect(result.userId).toBe('');
      expect(result.userInternalId).toBe('');
      expect(result.userEmail).toBe('');
      expect(result.isTestMode).toBe(true);
      expect(result.shouldSkipAuth).toBe(true);
      expect(auth).not.toHaveBeenCalled();
    });

    it('should still authenticate in test mode when skipAuthInTestMode is false', async () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'test-secret-123' },
      });

      const result = await authenticateRequest(request, false);

      expect(result.userId).toBe('clerk-user-123');
      expect(result.userInternalId).toBe('internal-user-123');
      expect(result.userEmail).toBe('test@example.com');
      expect(result.isTestMode).toBe(true);
      expect(result.shouldSkipAuth).toBe(false);
      expect(auth).toHaveBeenCalled();
    });

    it('should throw AuthenticationError when userId is null', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/test');

      await expect(authenticateRequest(request, false)).rejects.toThrow('Authentication required');
    });

    it('should throw NotFoundError when user is not in database', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/test');

      await expect(authenticateRequest(request, false)).rejects.toThrow('not found');
    });

    it('should query database with correct Clerk user ID', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      });

      const request = new NextRequest('http://localhost:3000/api/test');
      await authenticateRequest(request, false);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('id, email');
      expect(mockEq).toHaveBeenCalledWith('clerk_user_id', 'clerk-user-123');
    });

    it('should not authenticate in test mode with wrong bypass token', async () => {
      process.env.NODE_ENV = 'development';
      process.env.TEST_BYPASS_TOKEN = 'test-secret-123';
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: { 'X-Test-Bypass': 'wrong-token' },
      });

      const result = await authenticateRequest(request, true);

      // Should not be in test mode with wrong token, so auth should run
      expect(result.isTestMode).toBe(false);
      expect(result.shouldSkipAuth).toBe(false);
      expect(auth).toHaveBeenCalled();
    });
  });

  describe('getAuthenticatedUser', () => {
    const mockUser = {
      id: 'internal-user-123',
      clerk_user_id: 'clerk-user-123',
      email: 'test@example.com',
    };

    beforeEach(() => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
          }),
        }),
      });
    });

    it('should return authenticated user information', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });

      const result = await getAuthenticatedUser();

      expect(result.userId).toBe('clerk-user-123');
      expect(result.userInternalId).toBe('internal-user-123');
      expect(result.userEmail).toBe('test@example.com');
    });

    it('should throw AuthenticationError when no userId from Clerk', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: null });

      await expect(getAuthenticatedUser()).rejects.toThrow('Authentication required');
    });

    it('should throw NotFoundError when user not in database', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });

      await expect(getAuthenticatedUser()).rejects.toThrow('not found');
    });

    it('should query database correctly', async () => {
      (auth as unknown as jest.Mock).mockResolvedValue({ userId: 'clerk-user-123' });
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      });

      await getAuthenticatedUser();

      expect(supabaseAdmin.from).toHaveBeenCalledWith('users');
      expect(mockSelect).toHaveBeenCalledWith('id, email');
      expect(mockEq).toHaveBeenCalledWith('clerk_user_id', 'clerk-user-123');
      expect(mockMaybeSingle).toHaveBeenCalled();
    });
  });
});
