/**
 * Tests for lib/ndi-helpers.ts
 *
 * Tests NDI (New Dietary Ingredient) and ODI (Old Dietary Ingredient) compliance validation
 * for dietary supplements under DSHEA 1994 regulations
 */

import { checkNDICompliance, formatNDIInfo, type NDIIngredient } from '@/lib/ndi-helpers';
import { createMockNDIIngredient, createMockODIIngredient } from '../utils/mocks';

// Mock ingredient cache
jest.mock('@/lib/ingredient-cache', () => ({
  getCachedNDIIngredients: jest.fn().mockResolvedValue([
    {
      id: '123e4567-e89b-12d3-a456-426614174001',
      notification_number: 1,
      report_number: 'NDI 001',
      ingredient_name: 'Astaxanthin',
      firm: 'Test Firm',
      submission_date: '2024-01-01',
      fda_response_date: '2024-02-01',
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174002',
      notification_number: 2,
      report_number: 'NDI 002',
      ingredient_name: 'Beta-glucan derived from yeast',
      firm: 'Another Firm',
      submission_date: '2024-03-01',
      fda_response_date: null,
    },
  ]),
  getCachedODIIngredients: jest.fn().mockResolvedValue([
    {
      id: '123e4567-e89b-12d3-a456-426614174003',
      ingredient_name: 'Ginseng',
      synonyms: ['Panax ginseng', 'Korean ginseng'],
      source_organization: 'AHPA',
      is_active: true,
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174004',
      ingredient_name: 'Echinacea',
      synonyms: ['Purple coneflower'],
      source_organization: 'UNPA',
      is_active: true,
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174005',
      ingredient_name: 'Vitamin C',
      synonyms: ['Ascorbic Acid', 'L-ascorbic acid'],
      source_organization: 'CRN',
      is_active: true,
    },
  ]),
}));

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('NDI Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkNDICompliance', () => {
    it('should return empty results for empty ingredient list', async () => {
      const result = await checkNDICompliance([]);

      expect(result.results).toEqual([]);
      expect(result.summary.totalChecked).toBe(0);
      expect(result.summary.withNDI).toBe(0);
      expect(result.summary.withoutNDI).toBe(0);
      expect(result.summary.requiresNotification).toBe(0);
    });

    it('should identify ingredients with NDI notifications', async () => {
      const result = await checkNDICompliance(['Astaxanthin']);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].ingredient).toBe('Astaxanthin');
      expect(result.results[0].hasNDI).toBe(true);
      expect(result.results[0].matchType).toBe('exact');
      expect(result.results[0].requiresNDI).toBe(false);
      expect(result.results[0].complianceNote).toContain('NDI notification #1');
      expect(result.summary.withNDI).toBe(1);
    });

    it('should handle partial NDI matches', async () => {
      const result = await checkNDICompliance(['Beta-glucan']);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].hasNDI).toBe(true);
      expect(result.results[0].matchType).toBe('partial');
      expect(result.results[0].ndiMatch?.ingredient_name).toBe('Beta-glucan derived from yeast');
    });

    it('should identify pre-1994 ingredients (no NDI required)', async () => {
      const result = await checkNDICompliance(['Ginseng', 'Vitamin C']);

      expect(result.results).toHaveLength(2);

      // Ginseng
      expect(result.results[0].ingredient).toBe('Ginseng');
      expect(result.results[0].hasNDI).toBe(false);
      expect(result.results[0].requiresNDI).toBe(false);
      expect(result.results[0].complianceNote).toContain('marketed before October 15, 1994');
      expect(result.results[0].complianceNote).toContain('grandfathered under DSHEA');

      // Vitamin C
      expect(result.results[1].ingredient).toBe('Vitamin C');
      expect(result.results[1].hasNDI).toBe(false);
      expect(result.results[1].requiresNDI).toBe(false);
      expect(result.results[1].complianceNote).toContain('marketed before October 15, 1994');
    });

    it('should flag unknown ingredients as requiring verification', async () => {
      const result = await checkNDICompliance(['Unknown Novel Ingredient 2024']);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].ingredient).toBe('Unknown Novel Ingredient 2024');
      expect(result.results[0].hasNDI).toBe(false);
      expect(result.results[0].requiresNDI).toBe(true);
      expect(result.results[0].complianceNote).toContain(
        'No NDI notification found and ingredient not recognized'
      );
      expect(result.results[0].complianceNote).toContain('October 15, 1994');
      expect(result.results[0].complianceNote).toContain('75 days before marketing');
      expect(result.summary.requiresNotification).toBe(1);
    });

    it('should handle mixed ingredient types', async () => {
      const result = await checkNDICompliance([
        'Astaxanthin', // Has NDI
        'Ginseng', // Pre-1994
        'Novel Ingredient X', // Unknown
      ]);

      expect(result.results).toHaveLength(3);
      expect(result.summary.totalChecked).toBe(3);
      expect(result.summary.withNDI).toBe(1);
      expect(result.summary.withoutNDI).toBe(2);
      expect(result.summary.requiresNotification).toBe(1);

      // Astaxanthin
      expect(result.results[0].hasNDI).toBe(true);
      expect(result.results[0].requiresNDI).toBe(false);

      // Ginseng
      expect(result.results[1].hasNDI).toBe(false);
      expect(result.results[1].requiresNDI).toBe(false);

      // Novel Ingredient X
      expect(result.results[2].hasNDI).toBe(false);
      expect(result.results[2].requiresNDI).toBe(true);
    });

    it('should handle ingredient name normalization', async () => {
      const result = await checkNDICompliance([
        '  ASTAXANTHIN  ', // Uppercase with spaces
        'astaxanthin', // Lowercase
        'Ascorbic Acid', // Vitamin C synonym
      ]);

      expect(result.results).toHaveLength(3);

      // Both astaxanthin variants should match NDI
      expect(result.results[0].hasNDI).toBe(true);
      expect(result.results[1].hasNDI).toBe(true);

      // Ascorbic Acid should match pre-1994 vitamin C
      expect(result.results[2].hasNDI).toBe(false);
      expect(result.results[2].requiresNDI).toBe(false);
      expect(result.results[2].complianceNote).toContain('grandfathered');
    });
  });

  describe('formatNDIInfo', () => {
    it('should format complete NDI information', () => {
      const mockNDI: NDIIngredient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        notification_number: 123,
        report_number: 'NDI 123',
        ingredient_name: 'Test Ingredient',
        firm: 'Test Company',
        submission_date: '2024-01-15',
        fda_response_date: '2024-03-01',
      };

      const formatted = formatNDIInfo(mockNDI);

      expect(formatted).toContain('NDI Notification #123');
      expect(formatted).toContain('(NDI 123)');
      expect(formatted).toContain('Firm: Test Company');
      expect(formatted).toContain('Submitted:');
      expect(formatted).toContain('FDA Response:');
    });

    it('should handle NDI with missing optional fields', () => {
      const mockNDI: NDIIngredient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        notification_number: 456,
        report_number: null,
        ingredient_name: 'Test Ingredient',
        firm: null,
        submission_date: null,
        fda_response_date: null,
      };

      const formatted = formatNDIInfo(mockNDI);

      expect(formatted).toContain('NDI Notification #456');
      expect(formatted).not.toContain('Firm:');
      expect(formatted).not.toContain('Submitted:');
      expect(formatted).not.toContain('FDA Response:');
    });

    it('should format submission date correctly', () => {
      const mockNDI: NDIIngredient = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        notification_number: 789,
        report_number: 'NDI 789',
        ingredient_name: 'Test Ingredient',
        firm: 'Test Firm',
        submission_date: '2024-06-15',
        fda_response_date: null,
      };

      const formatted = formatNDIInfo(mockNDI);

      expect(formatted).toContain('NDI Notification #789');
      expect(formatted).toContain('Submitted:');
      expect(formatted).toMatch(/Submitted: \d+\/\d+\/\d+/); // Date format like 6/15/2024
    });
  });
});
