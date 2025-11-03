/**
 * Tests for lib/allergen-helpers.ts
 *
 * Tests major food allergen detection per FALCPA (2004) and FASTER Act (2021)
 * Includes exact matching, derivative matching, and fuzzy matching strategies
 */

import {
  checkIngredientForAllergens,
  checkIngredientsForAllergens,
  formatAllergenResults,
  type MajorAllergen,
  type AllergenCheckResult,
} from '@/lib/allergen-helpers';
import { createMockAllergen } from '../utils/mocks';

// Mock Supabase
jest.mock('@/lib/supabase', () => {
  const mockAllergens: MajorAllergen[] = [
    {
      id: '1',
      allergen_name: 'Milk',
      allergen_category: 'Dairy',
      common_name: "Cow's Milk",
      derivatives: ['whey', 'casein', 'lactose', 'butter', 'cream', 'cheese'],
      scientific_names: ['Bos taurus'],
      cross_reactive_allergens: [],
      is_active: true,
      notes: null,
      regulation_citation: 'FALCPA 2004',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      allergen_name: 'Eggs',
      allergen_category: 'Poultry',
      common_name: 'Chicken Eggs',
      derivatives: ['albumin', 'ovalbumin', 'egg white', 'egg yolk', 'lysozyme'],
      scientific_names: ['Gallus gallus domesticus'],
      cross_reactive_allergens: [],
      is_active: true,
      notes: null,
      regulation_citation: 'FALCPA 2004',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '3',
      allergen_name: 'Soy',
      allergen_category: 'Legumes',
      common_name: 'Soybean',
      derivatives: ['soybean', 'tofu', 'edamame', 'soy lecithin', 'miso'],
      scientific_names: ['Glycine max'],
      cross_reactive_allergens: [],
      is_active: true,
      notes: null,
      regulation_citation: 'FALCPA 2004',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '4',
      allergen_name: 'Crustacean Shellfish',
      allergen_category: 'Shellfish',
      common_name: 'Shellfish',
      derivatives: ['shrimp', 'crab', 'lobster', 'crayfish', 'prawn'],
      scientific_names: [],
      cross_reactive_allergens: [],
      is_active: true,
      notes: null,
      regulation_citation: 'FALCPA 2004',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ];

  return {
    supabase: {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            range: jest.fn(() => ({
              data: mockAllergens,
              error: null,
            })),
            order: jest.fn(() => ({
              range: jest.fn(() => ({
                data: mockAllergens,
                error: null,
              })),
            })),
          })),
        })),
      })),
    },
  };
});

describe('Allergen Helpers', () => {
  describe('checkIngredientForAllergens', () => {
    it('should detect exact allergen name match', async () => {
      const results = await checkIngredientForAllergens('Milk');

      expect(results).toHaveLength(1);
      expect(results[0].ingredient).toBe('Milk');
      expect(results[0].containsAllergen).toBe(true);
      expect(results[0].allergen?.allergen_name).toBe('Milk');
      expect(results[0].matchType).toBe('exact');
      expect(results[0].confidence).toBe('high');
    });

    it('should detect allergen derivatives', async () => {
      const results = await checkIngredientForAllergens('Whey');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].containsAllergen).toBe(true);
      expect(results[0].allergen?.allergen_name).toBe('Milk');
      expect(results[0].matchType).toBe('derivative');
      expect(results[0].confidence).toBe('high');
    });

    it('should handle case-insensitive matching', async () => {
      const results = await checkIngredientForAllergens('CASEIN');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].allergen?.allergen_name).toBe('Milk');
      expect(results[0].matchType).toBe('derivative');
    });

    it('should normalize ingredient names before matching', async () => {
      const results = await checkIngredientForAllergens('D-LACTOSE (FROM MILK) 5%');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].allergen?.allergen_name).toBe('Milk');
    });

    it('should detect fuzzy matches for compound ingredients', async () => {
      const results = await checkIngredientForAllergens('Shrimp Extract');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].allergen?.allergen_name).toBe('Crustacean Shellfish');
      expect(results[0].matchType).toBe('fuzzy');
      expect(results[0].confidence).toBe('medium');
    });

    it('should return empty array for non-allergen ingredients', async () => {
      const results = await checkIngredientForAllergens('Sugar');

      expect(results).toHaveLength(0);
    });

    it('should handle known false positives (royal jelly)', async () => {
      const results = await checkIngredientForAllergens('Royal Jelly');

      expect(results).toHaveLength(0);
    });

    it('should detect multiple derivatives in single ingredient', async () => {
      const results = await checkIngredientForAllergens('Egg Albumin');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].allergen?.allergen_name).toBe('Eggs');
    });
  });

  describe('checkIngredientsForAllergens', () => {
    it('should return empty results for empty ingredient list', async () => {
      const result = await checkIngredientsForAllergens([]);

      expect(result.allergensDetected).toEqual([]);
      expect(result.ingredientsWithAllergens).toEqual([]);
      expect(result.summary.totalIngredients).toBe(0);
      expect(result.summary.uniqueAllergensDetected).toBe(0);
    });

    it('should detect allergens in multiple ingredients', async () => {
      const result = await checkIngredientsForAllergens([
        'Water',
        'Whey Protein',
        'Sugar',
        'Soy Lecithin',
        'Salt',
      ]);

      expect(result.summary.totalIngredients).toBe(5);
      expect(result.summary.ingredientsWithAllergens).toBe(2); // Whey and Soy Lecithin
      expect(result.summary.uniqueAllergensDetected).toBe(2); // Milk and Soy
      expect(result.ingredientsWithAllergens).toHaveLength(2);
    });

    it('should track high and medium confidence matches', async () => {
      const result = await checkIngredientsForAllergens([
        'Casein', // Derivative - high confidence
        'Shrimp Extract', // Fuzzy - medium confidence
        'Butter', // Derivative - high confidence
      ]);

      expect(result.summary.highConfidenceMatches).toBeGreaterThanOrEqual(2);
      expect(result.summary.mediumConfidenceMatches).toBeGreaterThanOrEqual(1);
    });

    it('should identify all unique allergens detected', async () => {
      const result = await checkIngredientsForAllergens([
        'Milk',
        'Whey',
        'Eggs',
        'Albumin',
        'Soy Lecithin',
      ]);

      expect(result.summary.uniqueAllergensDetected).toBe(3); // Milk, Eggs, Soy
      expect(result.allergensDetected).toHaveLength(3);

      const allergenNames = result.allergensDetected.map((a) => a.allergen_name);
      expect(allergenNames).toContain('Milk');
      expect(allergenNames).toContain('Eggs');
      expect(allergenNames).toContain('Soy');
    });

    it('should provide ingredient-level details', async () => {
      const result = await checkIngredientsForAllergens(['Whey Protein', 'Egg White']);

      expect(result.ingredientsWithAllergens).toHaveLength(2);

      const wheyResult = result.ingredientsWithAllergens.find(
        (item) => item.ingredient === 'Whey Protein'
      );
      expect(wheyResult).toBeDefined();
      expect(wheyResult?.allergens.length).toBeGreaterThan(0);
      expect(wheyResult?.allergens[0].allergen?.allergen_name).toBe('Milk');

      const eggResult = result.ingredientsWithAllergens.find(
        (item) => item.ingredient === 'Egg White'
      );
      expect(eggResult).toBeDefined();
      expect(eggResult?.allergens[0].allergen?.allergen_name).toBe('Eggs');
    });

    it('should handle ingredients with no allergens', async () => {
      const result = await checkIngredientsForAllergens(['Water', 'Sugar', 'Salt', 'Citric Acid']);

      expect(result.summary.ingredientsWithAllergens).toBe(0);
      expect(result.summary.uniqueAllergensDetected).toBe(0);
      expect(result.allergensDetected).toHaveLength(0);
      expect(result.ingredientsWithAllergens).toHaveLength(0);
    });
  });

  describe('formatAllergenResults', () => {
    it('should return "No allergens detected" for empty results', () => {
      const formatted = formatAllergenResults([]);

      expect(formatted).toBe('No allergens detected');
    });

    it('should format high confidence matches with checkmark', () => {
      const mockResults: AllergenCheckResult[] = [
        {
          ingredient: 'Milk',
          containsAllergen: true,
          allergen: createMockAllergen({ allergen_name: 'Milk' }),
          matchType: 'exact',
          confidence: 'high',
        },
      ];

      const formatted = formatAllergenResults(mockResults);

      expect(formatted).toContain('✓');
      expect(formatted).toContain('Milk');
      expect(formatted).toContain('exact match');
    });

    it('should format medium confidence matches with question mark', () => {
      const mockResults: AllergenCheckResult[] = [
        {
          ingredient: 'Shrimp Extract',
          containsAllergen: true,
          allergen: createMockAllergen({ allergen_name: 'Crustacean Shellfish' }),
          matchType: 'fuzzy',
          confidence: 'medium',
        },
      ];

      const formatted = formatAllergenResults(mockResults);

      expect(formatted).toContain('?');
      expect(formatted).toContain('Crustacean Shellfish');
      expect(formatted).toContain('fuzzy match');
    });

    it('should format derivative matches', () => {
      const mockResults: AllergenCheckResult[] = [
        {
          ingredient: 'Whey',
          containsAllergen: true,
          allergen: createMockAllergen({ allergen_name: 'Milk' }),
          matchType: 'derivative',
          confidence: 'high',
        },
      ];

      const formatted = formatAllergenResults(mockResults);

      expect(formatted).toContain('Milk');
      expect(formatted).toContain('derivative');
    });

    it('should format multiple allergen results', () => {
      const mockResults: AllergenCheckResult[] = [
        {
          ingredient: 'Whey',
          containsAllergen: true,
          allergen: createMockAllergen({ allergen_name: 'Milk' }),
          matchType: 'derivative',
          confidence: 'high',
        },
        {
          ingredient: 'Egg White',
          containsAllergen: true,
          allergen: createMockAllergen({ allergen_name: 'Eggs' }),
          matchType: 'derivative',
          confidence: 'high',
        },
      ];

      const formatted = formatAllergenResults(mockResults);

      expect(formatted).toContain('Milk');
      expect(formatted).toContain('Eggs');
      expect(formatted).toContain(','); // Multiple results separated by comma
    });
  });
});
