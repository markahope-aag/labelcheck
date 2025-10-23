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
- **gras_ingredients**: 1,465 FDA GRAS (Generally Recognized as Safe) ingredients for compliance checking
- **organizations** + **organization_members**: Team collaboration features
- **user_settings**: User preferences (notifications, theme, timezone)
- **analysis_exports**: Export history tracking

### AI Analysis Flow
1. User uploads image to `/api/analyze`
2. Check usage limits against `usage_tracking` table
3. Fetch active regulatory documents from database
4. Send image + regulatory context to Claude 3.5 Sonnet (with retry logic for rate limits)
5. Parse JSON response containing compliance analysis
6. **Check GRAS compliance** for all detected ingredients using three-strategy matching
7. Save to `analyses` table with GRAS results, increment usage counter
8. Send email notification to user

### GRAS Ingredient Compliance
The system automatically validates all ingredients against the FDA GRAS database:

**Database Coverage:**
- 1,465 total ingredients (848 GRAS notices + 152 affirmed GRAS + 465 comprehensive additions)
- Covers ~95%+ of commercial food products
- Sourced from FDA GRAS Notice Inventory

**Matching Strategies** (implemented in `lib/gras-helpers.ts`):
1. **Exact match**: Case-insensitive comparison of ingredient names
2. **Synonym match**: Checks against alternative names for each ingredient
3. **Fuzzy match**: Partial word matching for complex ingredient names

**Integration:**
- Analysis results include `gras_compliance` object with detailed ingredient status
- Non-GRAS ingredients automatically flagged as CRITICAL priority recommendations
- UI displays color-coded ingredient tags (green=GRAS, red=non-GRAS)
- Hover tooltips show match type (exact/synonym/fuzzy)

**Key Files:**
- `lib/gras-helpers.ts`: Core matching and compliance checking logic
- `scrape-gras-notices.js`: Web scraper for FDA GRAS Notice Inventory
- `import-gras-notices.js`: Import scraped data with deduplication
- `supabase/migrations/20251022220000_create_gras_ingredients.sql`: Database schema
- `GRAS_DATABASE.md`: Comprehensive GRAS database documentation

Key implementation in `app/api/analyze/route.ts`:
- Uses OpenAI SDK with model `gpt-4o` for main analysis (fast, highly capable)
- Chat uses `gpt-4o-mini` for quick responses
- **JSON mode enabled** (`response_format: { type: 'json_object' }`) for reliable structured outputs
- **Automatic retry logic** with exponential backoff for rate limits (5s, 10s, 20s delays)
- Regulatory context is injected via `lib/regulatory-documents.ts`
- Images and PDFs are base64 encoded with `detail: 'high'` for better accuracy
- Images are base64 encoded, but only first 100 chars stored in DB
- **GRAS compliance checking** runs automatically after analysis completes
- Usage limits: Basic (10/month), Pro (100/month), Enterprise (unlimited = -1)

### Analysis Sessions (Iterative Improvement Workflow)

**New Feature:** Transforms one-shot analysis into an iterative compliance improvement workspace.

**Database Tables:**
- `analysis_sessions`: Tracks user's compliance improvement sessions
- `analysis_iterations`: Records each interaction (analysis, chat, text check, revision)
- Sessions created automatically on first analysis, linked by `session_id`

**Three Iteration Methods:**
1. **💬 Ask AI Questions** (`/api/analyze/chat`)
   - Context-aware chat about compliance findings
   - Remembers last 5 chat exchanges
   - Full analysis context provided to AI
   - Creates `chat_question` iterations

2. **📝 Check Text Alternative** (`/api/analyze/text`)
   - Dual-mode: paste text OR upload PDF
   - PDF uses GPT-4o's vision capabilities (not simple extraction)
   - Compares to original analysis (issues resolved/remaining/new)
   - Creates `text_check` iterations

3. **📸 Upload Revised Label** (analyze page revision mode)
   - User uploads improved label version
   - Visual comparison card shows improvement metrics
   - Displays previous vs current issue counts (e.g., 5 → 2 issues)
   - Green highlight for fully compliant results
   - Creates `revised_analysis` iterations

**Important Implementation Notes:**
- **All session operations use `supabaseAdmin`** (with `useAdmin: true`) to bypass RLS
- Sessions are created with admin privileges, so reads/writes must also use admin
- Chat context includes: latest analysis + last 5 exchanges + all recommendations
- Comparison logic counts issues across all sections to show improvement
- Session persists in frontend state (`sessionId`) throughout interaction

**Files:**
- Session management: `lib/session-helpers.ts`
- Main analyze page: `app/analyze/page.tsx`
- Chat API: `app/api/analyze/chat/route.ts`
- Text checker API: `app/api/analyze/text/route.ts`
- Chat UI: `components/AnalysisChat.tsx`
- Text checker UI: `components/TextChecker.tsx`
- Feature docs: `docs/ANALYSIS_SESSIONS_FEATURE.md`

### AI Analysis Quality & Refinement

**Known Issue: Marketing Claims Consistency**
- Initial analysis may not always flag problematic marketing terms (e.g., "superfood")
- Chat follow-ups provide more detailed scrutiny
- Need to enhance initial analysis prompt to catch these consistently

**Systematic Refinement Approach:**
1. **Build Evaluation Dataset**: Create test cases with expected findings
2. **Prompt Versioning**: Version control prompts, A/B test different versions
3. **Iterative Loop**: Run evaluation → Refine prompt → Test → Expert review → Deploy
4. **Monitor Real Usage**: Track when users ask chat about issues missed in initial analysis
5. **Domain Expert Validation**: Regular review by FDA compliance experts

**Prompt Engineering Best Practices:**
- Be specific about red flag terms (superfood, immunity, detox, natural healing)
- Use chain-of-thought reasoning for complex regulations
- Include few-shot examples of good/bad labels
- Enforce structured JSON output for consistency
- Use temperature=0 for deterministic compliance analysis

**Next Priority:** Enhance analysis prompt to explicitly scrutinize marketing terms that could be implied health claims.

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
- **Supports both images and PDFs** with proper MIME type detection
- Images are preprocessed using Sharp (`lib/image-processing.ts`) before AI analysis:
  - Auto-rotates based on EXIF orientation
  - Upscales if too small (min 1500px on longest side)
  - Enhances contrast and sharpness for better text recognition
  - Validates file size (max 10MB by default)
- **Drag-and-drop upload** with proper event handling and visual feedback
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

### Team/Organization Invitation Flow
The application supports team collaboration through organization invitations:

#### Database Tables
- **organizations**: Team workspace details (name, slug, plan_tier, max_members)
- **organization_members**: Active members with roles (owner, admin, member, viewer)
- **pending_invitations**: Invitations awaiting acceptance (includes invitation_token, expires_at, accepted_at)

#### Invitation Process
1. **Sending Invitations** (`/api/organizations/members` POST):
   - Checks if invitee email exists in `users` table
   - If user exists: Adds directly to `organization_members`
   - If user doesn't exist: Creates record in `pending_invitations` with secure token
   - Sends email via Resend with invitation link containing token
   - Invitation expires after 7 days

2. **Accepting Invitations** (`/api/accept-invitation` POST):
   - Validates invitation token from `pending_invitations` table
   - Fetches user's email from Clerk (source of truth) using `clerkClient()`
   - **Email validation is informational only** - logs mismatch but doesn't block acceptance
   - Checks if user is already a member (prevents duplicates)
   - Adds user to `organization_members` table
   - Marks invitation as accepted (`accepted_at` timestamp)

3. **Fetching Team Members** (`/api/organizations/members` GET):
   - Uses `supabaseAdmin` to bypass RLS policies
   - Fetches both active members and pending invitations
   - Specifies exact foreign key relationship: `users!organization_members_user_id_fkey`
   - Returns combined data for frontend display

#### Important Implementation Notes
- **RLS Bypass Required**: Team member queries must use `supabaseAdmin` to access organization-wide data
- **Foreign Key Ambiguity**: The `organization_members` table has TWO relationships to `users` (via `user_id` and `invited_by`). Always specify the exact relationship name in Supabase queries to avoid PGRST201 errors
- **Email Flexibility**: Invitations can be accepted even if the signed-in user's email doesn't exactly match the invitation email (e.g., email aliases). The invitation token serves as the authorization mechanism
- **Same User Limitation**: A user can only be a member of an organization once. If already a member, invitation acceptance returns a 200 status with "already a member" message

### History Page Features
- **Search**: Filter analyses by product name, product type, or summary text
- **Status Filter**: Filter by compliance status (All, Compliant, Non-Compliant, Minor Issues)
- **Sort Options**: Newest First (default), Oldest First, Name (A-Z)
- **Results Counter**: Shows "Showing X of Y analyses"
- **Color-coded ingredient display**: Visual tags showing GRAS compliance status
- All filtering and sorting happens client-side for instant results
- Maintains backward compatibility with old and new analysis data formats

### UI/UX Enhancements
**Compliance Status Formatting:**
- All status displays use proper capitalization and hyphens (e.g., "Non-Compliant", "Potentially-Non-Compliant")
- Helper function `formatComplianceStatus()` ensures consistent formatting across all pages
- Applied to: analyze page, analysis detail page, and all compliance badges

**Ingredient Display:**
- Color-coded tags: Green background for GRAS-compliant, Red background for non-GRAS
- Hover tooltips show match type and compliance status
- Responsive layout with flex-wrap for mobile compatibility
- Consistent styling across analyze and history pages

## Environment Variables Required

See `SETUP_GUIDE.md` for detailed setup instructions. Key variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# OpenAI
OPENAI_API_KEY=

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
12. **Organization Member Queries**: When querying `organization_members` with a join to `users`, always specify the exact foreign key relationship (`users!organization_members_user_id_fkey`) to avoid ambiguity errors, since the table has multiple foreign keys to `users` (via `user_id` and `invited_by`).
13. **Invitation Email Validation**: Invitation acceptance does NOT enforce strict email matching between the invitation email and the signed-in user's email. The invitation token is the authorization mechanism, allowing email aliases to work correctly.
14. **Team Member API**: Always use `/api/organizations/members` GET endpoint (which uses `supabaseAdmin`) instead of client-side Supabase queries to fetch team members, as RLS policies prevent cross-user data access.

## Key Files to Reference

- `middleware.ts` - Route protection and public route configuration
- `app/api/analyze/route.ts` - Core AI analysis logic
- `app/api/share/route.ts` - Share link generation endpoint
- `app/share/[token]/page.tsx` - Public share page for viewing shared analyses
- `app/analysis/[id]/page.tsx` - Authenticated analysis detail page
- `app/history/page.tsx` - Analysis history with search/filter features
- `app/team/page.tsx` - Team management page for viewing members and sending invitations
- `app/accept-invitation/page.tsx` - Invitation acceptance page
- `app/api/accept-invitation/route.ts` - Invitation acceptance endpoint with email validation
- `app/api/organizations/members/route.ts` - Team member listing (GET) and invitation creation (POST)
- `app/admin/documents/page.tsx` - Admin regulatory document management UI with PDF upload
- `app/api/admin/documents/route.ts` - Admin document listing and creation endpoint
- `app/api/admin/documents/[id]/route.ts` - Admin document update and delete endpoint
- `app/api/admin/documents/extract-pdf/route.ts` - PDF text extraction endpoint
- `app/api/analyze/chat/route.ts` - Analysis Sessions chat endpoint with context-aware AI
- `app/api/analyze/text/route.ts` - Text/PDF checker endpoint for prospective content
- `components/AnalysisChat.tsx` - Chat interface component for asking AI questions
- `components/TextChecker.tsx` - Dual-mode text/PDF checker component
- `lib/session-helpers.ts` - Analysis Sessions CRUD operations and context building
- `lib/subscription-helpers.ts` - Usage and subscription queries
- `lib/export-helpers.ts` - PDF/CSV/JSON export functions
- `lib/pdf-helpers.ts` - PDF text extraction and metadata parsing utilities
- `lib/email-templates.ts` - Email template generation including invitation emails
- `supabase-migrations/add-regulatory-document-fields.sql` - Database migration for regulatory document fields
- `supabase/migrations/20251022000000_create_analysis_sessions.sql` - Analysis Sessions database migration
- `docs/ANALYSIS_SESSIONS_FEATURE.md` - Complete Analysis Sessions feature specification
- `SESSION_NOTES.md` - Session-by-session development notes and next steps
- `SETUP_GUIDE.md` - Comprehensive setup and testing documentation
