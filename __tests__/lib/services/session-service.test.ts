/**
 * Tests for lib/services/session-service.ts
 *
 * Tests session access control and ownership verification:
 * - Session access validation
 * - Analysis ownership verification
 * - Organization membership checking
 */

import {
  getSessionWithAccess,
  verifyAnalysisOwnership,
  getOrganizationWithMembership,
} from '@/lib/services/session-service';
import * as sessionHelpers from '@/lib/session-helpers';
import { supabaseAdmin } from '@/lib/supabase';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock('@/lib/session-helpers', () => ({
  getSessionWithIterations: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Session Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSessionWithAccess', () => {
    const mockSession = {
      id: 'session-123',
      user_id: 'user-123',
      title: 'Test Session',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockIterations = [
      {
        id: 'iter-1',
        session_id: 'session-123',
        iteration_type: 'image_analysis',
        created_at: '2024-01-01T00:00:00Z',
      },
    ];

    it('should return session with access when user owns the session', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: mockSession,
        iterations: mockIterations,
        error: null,
      });

      const result = await getSessionWithAccess('session-123', 'user-123', true);

      expect(result.hasAccess).toBe(true);
      expect(result.session).toEqual(mockSession);
      expect(result.iterations).toEqual(mockIterations);
      expect(result.error).toBeUndefined();
    });

    it('should deny access when user does not own the session', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: mockSession,
        iterations: mockIterations,
        error: null,
      });

      const result = await getSessionWithAccess('session-123', 'different-user', true);

      expect(result.hasAccess).toBe(false);
      expect(result.session).toEqual(mockSession);
      expect(result.iterations).toEqual(mockIterations);
      expect(result.error).toBe('Access denied to this session');
    });

    it('should deny access when session is not found', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: null,
        iterations: [],
        error: 'Session not found',
      });

      const result = await getSessionWithAccess('nonexistent-session', 'user-123', true);

      expect(result.hasAccess).toBe(false);
      expect(result.session).toBeNull();
      expect(result.iterations).toEqual([]);
      expect(result.error).toBe('Session not found');
    });

    it('should deny access when there is a database error', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: null,
        iterations: [],
        error: 'Database connection failed',
      });

      const result = await getSessionWithAccess('session-123', 'user-123', true);

      expect(result.hasAccess).toBe(false);
      expect(result.error).toBe('Session not found');
    });

    it('should use admin client when useAdmin is true', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: mockSession,
        iterations: mockIterations,
        error: null,
      });

      await getSessionWithAccess('session-123', 'user-123', true);

      expect(sessionHelpers.getSessionWithIterations).toHaveBeenCalledWith('session-123', true);
    });

    it('should use regular client when useAdmin is false', async () => {
      (sessionHelpers.getSessionWithIterations as jest.Mock).mockResolvedValue({
        session: mockSession,
        iterations: mockIterations,
        error: null,
      });

      await getSessionWithAccess('session-123', 'user-123', false);

      expect(sessionHelpers.getSessionWithIterations).toHaveBeenCalledWith('session-123', false);
    });
  });

  describe('verifyAnalysisOwnership', () => {
    const mockAnalysis = {
      id: 'analysis-123',
      user_id: 'user-123',
      product_name: 'Test Product',
      created_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn(),
            }),
          }),
        }),
      });
    });

    it('should confirm ownership when analysis belongs to user', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockAnalysis, error: null }),
      };
      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      const result = await verifyAnalysisOwnership('analysis-123', 'user-123');

      expect(result.owned).toBe(true);
      if (result.owned) {
        expect(result.analysis).toEqual(mockAnalysis);
      }
      expect(supabaseAdmin.from).toHaveBeenCalledWith('analyses');
    });

    it('should deny ownership when analysis is not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      const result = await verifyAnalysisOwnership('nonexistent-analysis', 'user-123');

      expect(result.owned).toBe(false);
      if (!result.owned) {
        expect(result.error).toBe('Analysis not found or access denied');
      }
    });

    it('should deny ownership when user does not match', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      const result = await verifyAnalysisOwnership('analysis-123', 'different-user');

      expect(result.owned).toBe(false);
    });

    it('should query with correct user_id and analysis_id filters', async () => {
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockAnalysis, error: null });

      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        maybeSingle: mockMaybeSingle,
      });

      await verifyAnalysisOwnership('analysis-123', 'user-123');

      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('id', 'analysis-123');
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
    });
  });

  describe('getOrganizationWithMembership', () => {
    const mockOrganization = {
      id: 'org-123',
      name: 'Test Organization',
      slug: 'test-org',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockMembership = {
      id: 'member-123',
      organization_id: 'org-123',
      user_id: 'user-123',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
    };

    beforeEach(() => {
      (supabaseAdmin.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn(),
          }),
        }),
      });
    });

    it('should return organization with membership when user is a member', async () => {
      let callCount = 0;
      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        callCount++;
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: callCount === 1 ? mockOrganization : mockMembership,
            error: null,
          }),
        };
        return mockChain;
      });

      const result = await getOrganizationWithMembership('org-123', 'user-123');

      expect(result.hasAccess).toBe(true);
      expect(result.organization).toEqual(mockOrganization);
      expect(result.membership).toEqual(mockMembership);
      expect(result.role).toBe('admin');
    });

    it('should deny access when organization is not found', async () => {
      const mockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabaseAdmin.from as jest.Mock).mockReturnValue(mockChain);

      const result = await getOrganizationWithMembership('nonexistent-org', 'user-123');

      expect(result.hasAccess).toBe(false);
      expect(result.organization).toBeNull();
      expect(result.membership).toBeNull();
      expect(result.role).toBeUndefined();
    });

    it('should deny access when user is not a member', async () => {
      let callCount = 0;
      (supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        callCount++;
        const mockChain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: callCount === 1 ? mockOrganization : null,
            error: null,
          }),
        };
        return mockChain;
      });

      const result = await getOrganizationWithMembership('org-123', 'non-member-user');

      expect(result.hasAccess).toBe(false);
      expect(result.organization).toEqual(mockOrganization);
      expect(result.membership).toBeNull();
      expect(result.role).toBeUndefined();
    });

    it('should query organizations and members tables correctly', async () => {
      const fromSpy = jest.spyOn(supabaseAdmin, 'from');

      let callCount = 0;
      (supabaseAdmin.from as jest.Mock).mockImplementation(() => {
        callCount++;
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: callCount === 1 ? mockOrganization : mockMembership,
            error: null,
          }),
        };
      });

      await getOrganizationWithMembership('org-123', 'user-123');

      expect(fromSpy).toHaveBeenCalledWith('organizations');
      expect(fromSpy).toHaveBeenCalledWith('organization_members');
    });
  });
});
