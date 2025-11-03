/**
 * Test Mocks and Utilities
 *
 * This file provides mock implementations for external dependencies
 * used throughout the test suite.
 */

import type { GRASIngredient, NDIIngredient, OldDietaryIngredient, GRASStatus } from '@/types';

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
