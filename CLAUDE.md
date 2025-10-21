# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LabelCheck is a SaaS application for analyzing food packaging labels for FDA and USDA regulatory compliance using AI. The application uses Next.js 14 with TypeScript, Clerk for authentication, Stripe for payments, Supabase for database, and Anthropic's Claude AI for label analysis.

## Common Development Commands

### Development
```bash
npm run dev           # Start development server on http://localhost:3000
npm run build         # Build production bundle
npm run start         # Start production server
npm run lint          # Run ESLint
npm run typecheck     # Type check without emitting files
```

### Testing
The project currently has no test suite configured. When adding tests, consider using Jest or Vitest with React Testing Library.

## Architecture & Key Concepts

### Authentication & User Flow
- **Clerk** handles all authentication (sign-in/sign-up)
- Clerk webhooks (`/api/webhooks/clerk`) sync user data to Supabase `users` table
- All authenticated routes are protected via `middleware.ts` using `clerkMiddleware`
- Public routes: `/`, `/pricing`, `/sign-in`, `/sign-up`, `/share/[token]`, and webhook endpoints

### Database Architecture (Supabase)
The database uses PostgreSQL with Row Level Security (RLS) enabled on all tables:

- **users**: Synced from Clerk, stores `stripe_customer_id`
- **subscriptions**: Tracks plan tier (basic/pro/enterprise), Stripe subscription details
- **usage_tracking**: Monthly usage limits, keyed by `user_id` + `month` (YYYY-MM format)
- **analyses**: Stores analysis results with truncated image previews (not full images), includes `share_token` for public sharing
- **regulatory_documents**: FDA/USDA regulations used for AI analysis context
- **organizations** + **organization_members**: Team collaboration features
- **user_settings**: User preferences (notifications, theme, timezone)
- **analysis_exports**: Export history tracking

### AI Analysis Flow
1. User uploads image to `/api/analyze`
2. Check usage limits against `usage_tracking` table
3. Fetch active regulatory documents from database
4. Send image + regulatory context to Claude 3.5 Sonnet
5. Parse JSON response containing compliance analysis
6. Save to `analyses` table, increment usage counter
7. Send email notification to user

Key implementation in `app/api/analyze/route.ts`:
- Uses `@anthropic-ai/sdk` with model `claude-3-5-sonnet-20241022`
- Regulatory context is injected via `lib/regulatory-documents.ts`
- Images are base64 encoded, but only first 100 chars stored in DB
- Usage limits: Basic (10/month), Pro (100/month), Enterprise (unlimited = -1)

### Payment & Subscription Flow
1. User selects plan on `/pricing`
2. `/api/create-checkout-session` creates Stripe checkout
3. Stripe webhooks (`/api/webhooks/stripe`) handle subscription lifecycle
4. Events processed: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_*`
5. Subscription changes update `subscriptions` table and trigger `usage_tracking` limit updates

### Helper Libraries Organization
- `lib/supabase.ts`: Supabase client + TypeScript interfaces (exports both `supabase` and `supabaseAdmin`)
- `lib/subscription-helpers.ts`: Subscription/usage query helpers
- `lib/regulatory-documents.ts`: Document fetching and context building
- `lib/export-helpers.ts`: PDF/CSV/JSON export utilities using jsPDF
- `lib/email-templates.ts`: HTML email template generation
- `lib/image-processing.ts`: Sharp-based image preprocessing for AI analysis
- `lib/pdf-helpers.ts`: PDF text extraction utilities using pdf-parse-fork
- `lib/constants.ts`: Plan limits, pricing, and feature definitions

### Path Aliases
The project uses `@/*` to reference root-level imports:
```typescript
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
```

## Important Implementation Details

### Usage Tracking Logic
- Usage is tracked monthly with format `YYYY-MM` (e.g., "2025-10")
- If no usage record exists for current month, one is auto-created during analysis
- Limits: `-1` means unlimited (used for enterprise plan)
- Check in `app/api/analyze/route.ts` enforces limits before analysis

### Image Handling
- Images are preprocessed using Sharp (`lib/image-processing.ts`) before AI analysis:
  - Auto-rotates based on EXIF orientation
  - Upscales if too small (min 1500px on longest side)
  - Enhances contrast and sharpness for better text recognition
  - Validates file size (max 10MB by default)
- Images are NOT permanently stored in cloud storage
- Only first 100 characters of base64 string stored for preview purposes
- Full image sent to Claude API but discarded after analysis
- Image preview format: `data:image/jpeg;base64,{truncated}...`

### Webhook Signature Verification
Both Clerk and Stripe webhooks verify signatures:
- Clerk uses `Webhook` from `@clerk/nextjs/server`
- Stripe uses `stripe.webhooks.constructEvent()`
- Always verify signatures before processing webhook data

### Role-Based Access Control
- Admin routes (`/admin/*`) require `role: "admin"` in Clerk public metadata
- Organization roles: owner, admin, member, viewer (stored in `organization_members`)
- RLS policies enforce data isolation between users/orgs

### Admin Panel
The admin panel (`/admin`) provides comprehensive management tools for administrators:

- **Dashboard** (`/admin`): Overview stats including total users, active subscriptions, analyses, and monthly revenue
- **Users** (`/admin/users`): View all users with subscription status and analysis counts
- **Subscriptions** (`/admin/subscriptions`): Manage all customer subscriptions with plan details and billing periods
- **Analytics** (`/admin/analytics`): Usage analytics and trends
- **Documents** (`/admin/documents`): Manage regulatory documents used for AI analysis
- **Settings** (`/admin/settings`): System configuration and settings
- **Pricing** (`/admin/pricing`): Manage pricing plans and tiers

**Important**: All admin API routes (`/api/admin/*`) must use `supabaseAdmin` instead of `supabase` to bypass Row Level Security (RLS) policies and access data across all users. Regular `supabase` client respects RLS and will only return data for the authenticated user.

### Regulatory Document Management
The admin panel includes comprehensive regulatory document management features:

#### Database Schema
The `regulatory_documents` table includes the following fields:
- `id`: UUID primary key
- `title`: Document title (required)
- `description`: Brief description of the document
- `content`: Full text content of the regulation (required)
- `document_type`: Type of regulation - `federal_law`, `state_regulation`, `guideline`, `standard`, `policy`, or `other`
- `jurisdiction`: Geographic area where regulation applies (e.g., "United States", "California")
- `source`: Citation or reference (e.g., "FDA 21 CFR 101.9")
- `source_url`: URL to original document
- `effective_date`: Date when the regulation became effective (DATE type)
- `version`: Version number or identifier
- `category_id`: Foreign key to document categories
- `is_active`: Boolean flag for active/inactive status
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

#### PDF Upload Feature
Admins can upload PDF versions of regulatory documents:
- Upload endpoint: `/api/admin/documents/extract-pdf`
- Uses `pdf-parse-fork` library for text extraction (CommonJS compatible with Next.js)
- Maximum file size: 10MB
- Extracts both text content and metadata (title, author, subject, creator, page count)
- Auto-fills form fields with extracted data while preserving user-entered values
- Handles PDF processing errors gracefully with user feedback

Implementation in `lib/pdf-helpers.ts`:
```typescript
export async function extractTextFromPDF(buffer: Buffer): Promise<string>
export async function extractPDFMetadata(buffer: Buffer): Promise<{...}>
export function cleanExtractedText(text: string): string
```

#### Data Validation and Sanitization
- **Empty Date Handling**: The `effective_date` field is a PostgreSQL DATE type that cannot accept empty strings. The PUT endpoint (`/api/admin/documents/[id]/route.ts`) automatically converts empty strings to `null` before saving.
- **Document Type Validation**: Database enforces check constraint for valid document types
- **Admin-Only Operations**: All document management endpoints require admin role verification

### Export Functionality
- PDF exports use `jspdf` + `jspdf-autotable` libraries
- Three formats: PDF (formatted report), CSV (spreadsheet), JSON (raw data)
- Exports are tracked in `analysis_exports` table
- Individual analysis PDFs vs. batch monthly reports supported

### Share Functionality
- Users can generate shareable public links to analysis reports via `/api/share`
- Share tokens are 16-byte random hex strings stored in `analyses.share_token` column
- Tokens are generated on-demand (only when user clicks Share button)
- Once generated, share URLs remain permanent for that analysis
- Public share page at `/share/[token]` displays full compliance report without authentication
- Share dialog modal shows the URL with copy-to-clipboard functionality
- Available on both analyze page (after analysis completes) and analysis detail page (`/analysis/[id]`)

### History Page Features
- **Search**: Filter analyses by product name, product type, or summary text
- **Status Filter**: Filter by compliance status (All, Compliant, Non-Compliant, Minor Issues)
- **Sort Options**: Newest First (default), Oldest First, Name (A-Z)
- **Results Counter**: Shows "Showing X of Y analyses"
- All filtering and sorting happens client-side for instant results
- Maintains backward compatibility with old and new analysis data formats

## Environment Variables Required

See `SETUP_GUIDE.md` for detailed setup instructions. Key variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Anthropic AI
ANTHROPIC_API_KEY=

# Stripe Payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_BASIC=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_ENTERPRISE=

# Supabase Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Optional: Email Notifications
RESEND_API_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=
```

## Deployment Notes

- Optimized for Vercel deployment
- ESLint checks are disabled during builds (`next.config.js`)
- Update webhook URLs in Clerk and Stripe dashboards for production
- Switch Stripe to live mode with production keys
- All environment variables must be set in deployment platform

## Code Style & Patterns

### UI Components
- Uses shadcn/ui components from `components/ui/`
- Radix UI primitives for accessibility
- Tailwind CSS for styling with CSS variables defined in `globals.css`
- Theme support (light/dark) via `next-themes`

### Data Fetching Pattern
```typescript
// 1. Get Clerk userId
const { userId } = await auth();

// 2. Query Supabase for internal user ID
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('clerk_user_id', userId)
  .maybeSingle();

// 3. Use internal user.id for all DB operations
```

### Error Handling
- API routes return proper HTTP status codes (401, 404, 429, 500)
- Client errors logged to console, not exposed to users
- Webhook failures logged but don't crash the app

## Common Gotchas

1. **User IDs**: Clerk's `userId` ≠ Supabase `user.id`. Always map via `clerk_user_id` column.
2. **Usage Limits**: Enterprise plan uses `-1` for unlimited, not a large number.
3. **Month Format**: Usage tracking uses `YYYY-MM` string format, not Date objects.
4. **RLS Policies**: All Supabase queries require proper user context for RLS to work. Use `supabaseAdmin` from `lib/supabase.ts` to bypass RLS when needed (e.g., admin operations, creating users).
5. **Webhook Timing**: User must exist in Supabase before other operations. The `/api/analyze` endpoint has a fallback to auto-create users if the Clerk webhook hasn't fired yet.
6. **Base64 Image Storage**: Only truncated preview stored, not full image data.
7. **Image Processing**: Images are preprocessed before analysis but the original is not stored. If preprocessing fails, the original buffer is used as fallback.
8. **Share Tokens**: All existing analyses have NULL `share_token` until user clicks Share button. Share tokens are generated on-demand and persist permanently once created.
9. **PDF Parsing Library**: Use `pdf-parse-fork` instead of `pdf-parse` for Next.js compatibility. The original `pdf-parse` has ESM/CommonJS issues with Next.js webpack.
10. **Date Field Validation**: PostgreSQL DATE columns cannot accept empty strings. Always convert empty date strings to `null` before saving (e.g., `effective_date: value === '' ? null : value`).
11. **Admin API Routes**: All `/api/admin/*` endpoints must use `supabaseAdmin` client to bypass RLS and access cross-user data. Using regular `supabase` client will only return current user's data.

## Key Files to Reference

- `middleware.ts` - Route protection and public route configuration
- `app/api/analyze/route.ts` - Core AI analysis logic
- `app/api/share/route.ts` - Share link generation endpoint
- `app/share/[token]/page.tsx` - Public share page for viewing shared analyses
- `app/analysis/[id]/page.tsx` - Authenticated analysis detail page
- `app/history/page.tsx` - Analysis history with search/filter features
- `app/admin/documents/page.tsx` - Admin regulatory document management UI with PDF upload
- `app/api/admin/documents/route.ts` - Admin document listing and creation endpoint
- `app/api/admin/documents/[id]/route.ts` - Admin document update and delete endpoint
- `app/api/admin/documents/extract-pdf/route.ts` - PDF text extraction endpoint
- `lib/subscription-helpers.ts` - Usage and subscription queries
- `lib/export-helpers.ts` - PDF/CSV/JSON export functions
- `lib/pdf-helpers.ts` - PDF text extraction and metadata parsing utilities
- `supabase-migrations/add-regulatory-document-fields.sql` - Database migration for regulatory document fields
- `SETUP_GUIDE.md` - Comprehensive setup and testing documentation
