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
  AnalysisResult,
  GRASStatus,
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
    cas_number: null,
    gras_notice_number: 'GRN 000123',
    gras_status: 'affirmed' as GRASStatus,
    source_reference: null,
    category: null,
    approved_uses: null,
    limitations: null,
    synonyms: ['Test Synonym'],
    common_name: null,
    technical_name: null,
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
    notification_number: 1,
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
    source: 'AHPA',
    notes: null,
    is_active: true,
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
    category_rationale: 'Product is a conventional food item based on ingredients and label format',
    category_confidence: 'high',
    general_labeling: {
      statement_of_identity: {
        status: 'compliant',
        details: 'Product identity clearly stated',
        regulation_citation: '21 CFR 101.3',
      },
      net_quantity: {
        status: 'compliant',
        details: 'Net quantity properly declared',
        regulation_citation: '21 CFR 101.105',
      },
      manufacturer_address: {
        status: 'compliant',
        details: 'Manufacturer information complete',
        regulation_citation: '21 CFR 101.5',
      },
    },
    ingredient_labeling: {
      ingredients_list: ['Water', 'Sugar', 'Salt'],
      status: 'compliant',
      details: 'Ingredients properly listed',
      regulation_citation: '21 CFR 101.4',
    },
    allergen_labeling: {
      status: 'not_applicable',
      details: 'No major allergens present',
      regulation_citation: '21 USC 343(w)',
    },
    nutrition_labeling: {
      status: 'compliant',
      details: 'Nutrition facts properly formatted',
      regulation_citation: '21 CFR 101.9',
    },
    claims: {
      structure_function_claims: {
        claims_present: false,
        claims_found: [],
        status: 'compliant',
        regulation_citation: '21 USC 343(r)(6)',
      },
      nutrient_content_claims: {
        claims_present: false,
        claims_found: [],
        status: 'compliant',
        regulation_citation: '21 CFR 101.13',
      },
      health_claims: {
        claims_present: false,
        claims_found: [],
        status: 'compliant',
        regulation_citation: '21 CFR 101.14',
      },
      prohibited_claims: {
        claims_present: false,
        claims_found: [],
        status: 'compliant',
        regulation_citation: '21 USC 343',
      },
      details: 'No claims made',
      regulation_citation: '21 CFR 101.13',
    },
    overall_assessment: {
      primary_compliance_status: 'compliant',
      confidence_level: 'high',
      summary: 'Product label is compliant',
      key_findings: ['Clear labeling', 'Proper formatting'],
    },
    recommendations: [],
    compliance_table: [],
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
    notification_number: 1,
  }),
  createMockNDIIngredient({
    ingredient_name: 'Beta-glucan',
    notification_number: 2,
  }),
];

/**
 * Collection of test ODI ingredients
 */
export const testODIIngredients: OldDietaryIngredient[] = [
  createMockODIIngredient({
    ingredient_name: 'Ginseng',
    synonyms: ['Panax ginseng', 'Korean ginseng'],
    source: 'AHPA',
  }),
  createMockODIIngredient({
    ingredient_name: 'Echinacea',
    synonyms: ['Purple coneflower'],
    source: 'UNPA',
  }),
];
