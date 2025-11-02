/**
 * Type Definitions for API Requests and Responses
 *
 * These types define the shape of data sent to and received from API endpoints.
 */

import type { AnalysisResult } from './analysis';
import type {
  ProductCategory,
  PlanTier,
  OrganizationRole,
  ExportFormat,
  Analysis,
  RegulatoryDocument,
  User,
  Subscription,
} from './database';

// ============================================================================
// Common API Types
// ============================================================================

export interface APIError {
  error: string;
  details?: string;
  code?: string;
  statusCode?: number;
}

export interface APISuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export type APIResponse<T = unknown> = APISuccess<T> | APIError;

// ============================================================================
// Analysis API Types
// ============================================================================

export interface AnalyzeImageRequest {
  file: File;
  sessionId?: string | null;
  preClassifiedCategory?: ProductCategory | null;
}

export interface AnalyzeImageResponse extends AnalysisResult {
  id: string;
  image_name: string;
  compliance_status: string;
  issues_found: number;
  created_at: string;
  analysisType?: 'image_analysis';
  timestamp?: string;
  sessionId?: string | null;
  show_category_selector?: boolean;
  usage?: {
    used: number;
    limit: number;
  };
  session?: {
    id: string;
    title: string | null;
  } | null;
}

export interface AnalyzeTextRequest {
  sessionId: string;
  textContent?: string; // For text mode
  pdf?: File; // For PDF mode
}

export interface AnalyzeTextResponse extends AnalysisResult {
  iterationId: string | null;
  analysisType: 'text_check';
  timestamp: string;
}

export interface AnalyzeChatRequest {
  sessionId: string;
  question: string;
}

export interface AnalyzeChatResponse {
  response: string;
  iterationId: string | null;
  timestamp: string;
}

export interface SelectCategoryRequest {
  analysisId: string;
  selectedCategory: ProductCategory;
  selectionReason: string;
}

export interface SelectCategoryResponse {
  success: boolean;
  analysis: AnalysisResult;
}

// ============================================================================
// Share API Types
// ============================================================================

export interface CreateShareLinkRequest {
  analysisId: string;
}

export interface CreateShareLinkResponse {
  shareUrl: string;
  shareToken: string;
}

export interface GetSharedAnalysisResponse {
  analysis: Analysis;
  createdAt: string;
}

// ============================================================================
// Export API Types
// ============================================================================

export interface ExportAnalysisRequest {
  analysisId: string;
  format: ExportFormat;
}

export interface ExportAnalysisResponse {
  success: boolean;
  downloadUrl?: string; // For files
  data?: unknown; // For JSON exports
}

// ============================================================================
// Organization API Types
// ============================================================================

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  planTier: PlanTier;
}

export interface CreateOrganizationResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    plan_tier: PlanTier;
  };
}

export interface InviteMemberRequest {
  organizationId: string;
  email: string;
  role: OrganizationRole;
}

export interface InviteMemberResponse {
  success: boolean;
  invitation?: {
    id: string;
    email: string;
    role: OrganizationRole;
    invitation_token: string;
  };
  member?: {
    id: string;
    user_id: string;
    role: OrganizationRole;
  };
  message: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResponse {
  success: boolean;
  organization: {
    id: string;
    name: string;
  };
  message: string;
}

// ============================================================================
// Admin API Types
// ============================================================================

export interface AdminStatsResponse {
  totalUsers: number;
  activeSubscriptions: number;
  totalAnalyses: number;
  monthlyRevenue: number;
  recentAnalyses: Array<{
    id: string;
    user_email: string;
    product_name: string;
    compliance_status: string;
    created_at: string;
  }>;
}

export interface AdminUserResponse {
  users: Array<
    User & {
      subscription?: Subscription;
      analyses_count: number;
    }
  >;
  total: number;
}

export interface UpdateUserRequest {
  email?: string;
  role?: 'admin' | 'user';
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string | null;
  content?: string;
  document_type?:
    | 'federal_law'
    | 'state_regulation'
    | 'guideline'
    | 'standard'
    | 'policy'
    | 'other';
  jurisdiction?: string | null;
  source?: string | null;
  source_url?: string | null;
  effective_date?: string | null;
  version?: string | null;
  category_id?: string | null;
  is_active?: boolean;
}

export interface CreateDocumentRequest extends UpdateDocumentRequest {
  title: string;
  content: string;
}

export interface AdminDocumentResponse {
  documents: RegulatoryDocument[];
  total: number;
}

// ============================================================================
// Stripe/Payment API Types
// ============================================================================

export interface CreateCheckoutSessionRequest {
  plan: PlanTier;
}

export interface CreateCheckoutSessionResponse {
  url: string;
  sessionId: string;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

// ============================================================================
// Clerk/Auth API Types
// ============================================================================

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      email_address: string;
      id: string;
    }>;
    [key: string]: unknown;
  };
}
