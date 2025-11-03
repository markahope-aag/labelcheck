/**
 * Test Mocks and Utilities
 *
 * This file provides mock implementations for external dependencies
 * used throughout the test suite.
 */

import type {
  GRASIngredient,
  NDIIngredient,
  OldDietaryIngredient,
  MajorAllergen,
  AnalysisResult,
} from '@/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock GRAS ingredient
 */
export function createMockGRASIngredient(overrides?: Partial<GRASIngredient>): GRASIngredient {
  return {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ingredient_name: 'Test Ingredient',
    gras_notice_number: 'GRN 000123',
    notifier: 'Test Company',
    date_of_notice: '2024-01-01',
    synonyms: ['Test Synonym'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock NDI ingredient
 */
export function createMockNDIIngredient(overrides?: Partial<NDIIngredient>): NDIIngredient {
  return {
    id: '123e4567-e89b-12d3-a456-426614174001',
    notification_number: 'NDI 001',
    report_number: 'Report 001',
    ingredient_name: 'Test NDI Ingredient',
    firm: 'Test Firm',
    submission_date: '2024-01-01',
    fda_response_date: '2024-02-01',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock ODI ingredient
 */
export function createMockODIIngredient(
  overrides?: Partial<OldDietaryIngredient>
): OldDietaryIngredient {
  return {
    id: '123e4567-e89b-12d3-a456-426614174002',
    ingredient_name: 'Test ODI Ingredient',
    synonyms: ['ODI Synonym'],
    source_organization: 'AHPA',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock allergen
 */
export function createMockAllergen(overrides?: Partial<MajorAllergen>): MajorAllergen {
  return {
    id: '123e4567-e89b-12d3-a456-426614174003',
    allergen_name: 'Milk',
    derivatives: ['whey', 'casein', 'lactose'],
    regulation: 'FALCPA',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create a mock analysis result
 */
export function createMockAnalysisResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    product_name: 'Test Product',
    product_type: 'CONVENTIONAL_FOOD',
    product_category: 'CONVENTIONAL_FOOD',
    general_labeling: {
      statement_of_identity: {
        status: 'compliant',
        detail: 'Product identity clearly stated',
      },
      net_quantity_declaration: {
        status: 'compliant',
        detail: 'Net quantity properly declared',
      },
      manufacturer_info: {
        status: 'compliant',
        detail: 'Manufacturer information complete',
      },
    },
    ingredient_labeling: {
      ingredients_list: ['Water', 'Sugar', 'Salt'],
      status: 'compliant',
      detail: 'Ingredients properly listed',
    },
    allergen_labeling: {
      status: 'not_applicable',
      detail: 'No major allergens present',
    },
    nutrition_labeling: {
      status: 'compliant',
      detail: 'Nutrition facts properly formatted',
    },
    claims: {
      status: 'compliant',
      detail: 'No claims made',
    },
    overall_assessment: {
      primary_compliance_status: 'compliant',
      summary: 'Product label is compliant',
      key_strengths: ['Clear labeling', 'Proper formatting'],
      priority_concerns: [],
    },
    recommendations: [],
    regulatory_framework: 'FDA',
    ...overrides,
  };
}

// ============================================================================
// Supabase Mock
// ============================================================================

export const createMockSupabaseClient = () => {
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockGte = jest.fn().mockReturnThis();
  const mockLte = jest.fn().mockReturnThis();
  const mockLimit = jest.fn().mockReturnThis();
  const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });

  const mockFrom = jest.fn().mockReturnValue({
    select: mockSelect,
    eq: mockEq,
    gte: mockGte,
    lte: mockLte,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
  });

  return {
    from: mockFrom,
    // Helper to set up success responses
    mockSuccess: (data: any) => {
      mockMaybeSingle.mockResolvedValue({ data, error: null });
      mockSingle.mockResolvedValue({ data, error: null });
      return data;
    },
    // Helper to set up error responses
    mockError: (error: any) => {
      mockMaybeSingle.mockResolvedValue({ data: null, error });
      mockSingle.mockResolvedValue({ data: null, error });
      return error;
    },
  };
};

// ============================================================================
// Clerk Mock
// ============================================================================

export const createMockClerkAuth = (userId: string | null = 'test-user-id') => {
  return jest.fn().mockResolvedValue({ userId });
};

// ============================================================================
// OpenAI Mock
// ============================================================================

export const createMockOpenAIClient = () => {
  return {
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify(createMockAnalysisResult()),
              },
            },
          ],
        }),
      },
    },
  };
};

// ============================================================================
// Test Data Collections
// ============================================================================

/**
 * Collection of test GRAS ingredients
 */
export const testGRASIngredients: GRASIngredient[] = [
  createMockGRASIngredient({
    ingredient_name: 'Caffeine',
    gras_notice_number: 'GRN 000923',
    synonyms: ['1,3,7-trimethylxanthine'],
  }),
  createMockGRASIngredient({
    ingredient_name: 'Citric Acid',
    gras_notice_number: 'GRN 000094',
    synonyms: ['2-hydroxypropane-1,2,3-tricarboxylic acid'],
  }),
  createMockGRASIngredient({
    ingredient_name: 'Ascorbic Acid',
    gras_notice_number: 'GRN 000156',
    synonyms: ['Vitamin C', 'L-ascorbic acid'],
  }),
];

/**
 * Collection of test NDI ingredients
 */
export const testNDIIngredients: NDIIngredient[] = [
  createMockNDIIngredient({
    ingredient_name: 'Astaxanthin',
    notification_number: 'NDI 001',
  }),
  createMockNDIIngredient({
    ingredient_name: 'Beta-glucan',
    notification_number: 'NDI 002',
  }),
];

/**
 * Collection of test ODI ingredients
 */
export const testODIIngredients: OldDietaryIngredient[] = [
  createMockODIIngredient({
    ingredient_name: 'Ginseng',
    synonyms: ['Panax ginseng', 'Korean ginseng'],
    source_organization: 'AHPA',
  }),
  createMockODIIngredient({
    ingredient_name: 'Echinacea',
    synonyms: ['Purple coneflower'],
    source_organization: 'UNPA',
  }),
];

/**
 * Collection of test allergens
 */
export const testAllergens: MajorAllergen[] = [
  createMockAllergen({
    allergen_name: 'Milk',
    derivatives: ['whey', 'casein', 'lactose', 'butter'],
  }),
  createMockAllergen({
    allergen_name: 'Eggs',
    derivatives: ['albumin', 'ovalbumin', 'egg white', 'egg yolk'],
  }),
  createMockAllergen({
    allergen_name: 'Soy',
    derivatives: ['soybean', 'tofu', 'edamame', 'soy lecithin'],
  }),
];
