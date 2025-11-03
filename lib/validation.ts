/**
 * Centralized Validation Schemas using Zod
 *
 * This file contains all API input validation schemas for type-safe
 * runtime validation of requests across the application.
 *
 * Benefits:
 * - Type-safe validation with TypeScript inference
 * - Consistent error messages across all endpoints
 * - Self-documenting API contracts
 * - Runtime type checking prevents invalid data from reaching the database
 *
 * Usage:
 * ```typescript
 * import { analyzeRequestSchema } from '@/lib/validation';
 *
 * const result = analyzeRequestSchema.safeParse(data);
 * if (!result.success) {
 *   return NextResponse.json(
 *     { error: 'Validation failed', details: result.error.errors },
 *     { status: 400 }
 *   );
 * }
 * const validatedData = result.data;
 * ```
 */

import { z } from 'zod';
import { ProductCategory } from './supabase';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * UUID validation schema
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Product category validation
 */
export const productCategorySchema = z.enum([
  'CONVENTIONAL_FOOD',
  'DIETARY_SUPPLEMENT',
  'NON_ALCOHOLIC_BEVERAGE',
  'ALCOHOLIC_BEVERAGE',
]);

/**
 * Label name validation (optional, max 200 characters)
 */
export const labelNameSchema = z
  .string()
  .max(200, 'Label name must be 200 characters or less')
  .optional();

/**
 * Session ID validation (optional UUID)
 */
export const sessionIdSchema = z.string().uuid('Invalid session ID format').optional();

// ============================================================================
// File Upload Schemas
// ============================================================================

/**
 * Supported image MIME types
 */
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Supported document MIME types
 */
const supportedDocumentTypes = ['application/pdf'];

/**
 * All supported file types for analysis
 */
const supportedFileTypes = [...supportedImageTypes, ...supportedDocumentTypes];

/**
 * Image file validation (10MB max)
 */
export const imageFileSchema = z.custom<File>(
  (file) => {
    if (!(file instanceof File)) return false;
    if (file.size > 10 * 1024 * 1024) return false; // 10MB
    return supportedImageTypes.includes(file.type);
  },
  {
    message: 'File must be a valid image (JPEG, PNG, WebP) under 10MB',
  }
);

/**
 * PDF file validation (10MB max)
 */
export const pdfFileSchema = z.custom<File>(
  (file) => {
    if (!(file instanceof File)) return false;
    if (file.size > 10 * 1024 * 1024) return false; // 10MB
    return file.type === 'application/pdf';
  },
  {
    message: 'File must be a valid PDF under 10MB',
  }
);

/**
 * Any supported file type (image or PDF)
 */
export const anyFileSchema = z.custom<File>(
  (file) => {
    if (!(file instanceof File)) return false;
    if (file.size > 10 * 1024 * 1024) return false; // 10MB
    return supportedFileTypes.includes(file.type);
  },
  {
    message: 'File must be a valid image (JPEG, PNG, WebP) or PDF under 10MB',
  }
);

// ============================================================================
// /api/analyze - Main Analysis Endpoint
// ============================================================================

/**
 * Main analysis request validation
 */
export const analyzeRequestSchema = z.object({
  image: anyFileSchema,
  sessionId: sessionIdSchema,
  labelName: labelNameSchema,
  forcedCategory: productCategorySchema.optional(),
});

/**
 * Type inference for analyze request
 */
export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

// ============================================================================
// /api/analyze/chat - Analysis Chat Endpoint
// ============================================================================

/**
 * Chat request validation
 */
export const chatRequestSchema = z.object({
  sessionId: uuidSchema,
  question: z
    .string()
    .min(1, 'Question is required')
    .max(1000, 'Question must be 1000 characters or less'),
});

/**
 * Type inference for chat request
 */
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ============================================================================
// /api/analyze/text - Text Checker Endpoint
// ============================================================================

/**
 * Text checker request validation (text mode)
 */
export const textCheckerTextSchema = z.object({
  text: z
    .string()
    .min(10, 'Text must be at least 10 characters')
    .max(10000, 'Text must be 10,000 characters or less'),
  sessionId: uuidSchema,
});

/**
 * Text checker request validation (PDF mode)
 */
export const textCheckerPdfSchema = z.object({
  pdf: pdfFileSchema,
  sessionId: uuidSchema,
});

/**
 * Text checker request validation (either text or PDF)
 */
export const textCheckerRequestSchema = z.union([textCheckerTextSchema, textCheckerPdfSchema]);

/**
 * Type inference for text checker request
 */
export type TextCheckerRequest = z.infer<typeof textCheckerRequestSchema>;

// ============================================================================
// /api/share - Share Link Generation
// ============================================================================

/**
 * Share link generation request validation
 */
export const shareRequestSchema = z.object({
  analysisId: uuidSchema,
});

/**
 * Type inference for share request
 */
export type ShareRequest = z.infer<typeof shareRequestSchema>;

// ============================================================================
// Admin Endpoints - Document Management
// ============================================================================

/**
 * Document type validation
 */
export const documentTypeSchema = z.enum([
  'federal_law',
  'state_regulation',
  'guideline',
  'standard',
  'policy',
  'other',
]);

/**
 * Create regulatory document request validation
 */
export const createDocumentSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be 500 characters or less'),
  description: z.string().max(2000, 'Description must be 2000 characters or less').optional(),
  content: z.string().min(1, 'Content is required'),
  document_type: documentTypeSchema,
  jurisdiction: z.string().max(200, 'Jurisdiction must be 200 characters or less').optional(),
  source: z.string().max(500, 'Source must be 500 characters or less').optional(),
  source_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .or(z.literal('')),
  version: z.string().max(50, 'Version must be 50 characters or less').optional(),
  is_active: z.boolean().default(true),
});

/**
 * Update regulatory document request validation
 */
export const updateDocumentSchema = createDocumentSchema.partial();

/**
 * Type inference for document schemas
 */
export type CreateDocumentRequest = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentRequest = z.infer<typeof updateDocumentSchema>;

// ============================================================================
// Admin Endpoints - User Management
// ============================================================================

/**
 * User role validation
 */
export const userRoleSchema = z.enum(['user', 'admin']);

/**
 * Update user request validation
 */
export const updateUserSchema = z.object({
  role: userRoleSchema.optional(),
  plan_tier: z.enum(['basic', 'pro', 'enterprise']).optional(),
});

/**
 * Type inference for update user request
 */
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;

// ============================================================================
// Organization Endpoints
// ============================================================================

/**
 * Organization member role validation
 */
export const memberRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

/**
 * Create organization request validation
 */
export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(200, 'Name must be 200 characters or less'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100, 'Slug must be 100 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
});

/**
 * Invite member request validation
 */
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: memberRoleSchema,
});

/**
 * Update member role request validation
 */
export const updateMemberRoleSchema = z.object({
  role: memberRoleSchema,
});

/**
 * Type inference for organization schemas
 */
export type CreateOrganizationRequest = z.infer<typeof createOrganizationSchema>;
export type InviteMemberRequest = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleRequest = z.infer<typeof updateMemberRoleSchema>;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format Zod validation errors into user-friendly messages
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((error) => {
    const path = error.path.join('.');
    return path ? `${path}: ${error.message}` : error.message;
  });
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(errors: z.ZodError) {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: formatValidationErrors(errors),
    fields: errors.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  };
}

/**
 * Validate FormData with a schema
 *
 * Helper for validating multipart/form-data requests
 */
export function validateFormData<T extends z.ZodType>(
  formData: FormData,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: z.ZodError } {
  const data: Record<string, any> = {};

  // Convert FormData to object (using Array.from for TS compatibility)
  Array.from(formData.entries()).forEach(([key, value]) => {
    if (value instanceof File) {
      data[key] = value;
    } else {
      data[key] = value;
    }
  });

  return schema.safeParse(data);
}
