/**
 * Request Parsing Service
 *
 * Handles common request parsing patterns with test mode support.
 * Extracts the complex test-mode-aware validation logic that's repeated across routes.
 */

import { NextRequest } from 'next/server';
import { ZodSchema } from 'zod';
import { logger } from '@/lib/logger';
import { validateFormData } from '@/lib/validation';

/**
 * Test mode detection - checks if request is in E2E test mode
 */
export function isTestMode(request: NextRequest): boolean {
  const testBypass = request.headers.get('X-Test-Bypass');
  return process.env.NODE_ENV !== 'production' && testBypass === process.env.TEST_BYPASS_TOKEN;
}

/**
 * Parse JSON body with test mode support
 * In test mode, clones request to avoid consuming stream before auth
 */
export async function parseJsonBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  inTestMode: boolean
): Promise<{ success: true; data: T } | { success: false; error: any }> {
  try {
    // In test mode, clone first to allow validation before auth
    const body = inTestMode ? await request.clone().json() : await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data };
  } catch (error) {
    logger.error('Failed to parse JSON body', { error });
    return {
      success: false,
      error: { errors: [{ path: [], message: 'Invalid JSON format' }] },
    };
  }
}

/**
 * Parse FormData with test mode support
 */
export async function parseFormDataBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>,
  inTestMode: boolean
): Promise<{ success: true; data: T; formData: FormData } | { success: false; error: any }> {
  try {
    const formData = await request.formData();
    const result = validateFormData(formData, schema);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: result.data, formData };
  } catch (error) {
    logger.error('Failed to parse FormData', { error });
    return {
      success: false,
      error: { errors: [{ path: [], message: 'Invalid FormData' }] },
    };
  }
}

/**
 * Unified request parser that handles both JSON and FormData
 * Automatically detects content type and test mode
 */
export async function parseRequest<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<
  | { success: true; data: T; formData?: FormData; isTestMode: boolean }
  | { success: false; error: any; isTestMode: boolean }
> {
  const inTestMode = isTestMode(request);
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const result = await parseFormDataBody(request, schema, inTestMode);
    return { ...result, isTestMode: inTestMode };
  } else {
    const result = await parseJsonBody(request, schema, inTestMode);
    return { ...result, isTestMode: inTestMode };
  }
}

/**
 * Test-mode-aware validation wrapper
 * Returns validation errors BEFORE auth check in test mode (for proper 400 vs 401 order)
 */
export async function validateWithTestMode<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<{
  isTestMode: boolean;
  validationResult: { success: true; data: T } | { success: false; error: any };
  shouldReturnEarly: boolean;
}> {
  const inTestMode = isTestMode(request);

  if (inTestMode) {
    // Test mode: validate first
    const validationResult = await parseRequest(request, schema);
    return {
      isTestMode: inTestMode,
      validationResult,
      shouldReturnEarly: !validationResult.success,
    };
  } else {
    // Normal mode: caller should auth first, then validate
    return {
      isTestMode: false,
      validationResult: { success: false, error: null }, // Will be validated after auth
      shouldReturnEarly: false,
    };
  }
}
