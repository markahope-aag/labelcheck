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
- Public routes: `/`, `/pricing`, `/sign-in`, `/sign-up`, and webhook endpoints

### Database Architecture (Supabase)
The database uses PostgreSQL with Row Level Security (RLS) enabled on all tables:

- **users**: Synced from Clerk, stores `stripe_customer_id`
- **subscriptions**: Tracks plan tier (basic/pro/enterprise), Stripe subscription details
- **usage_tracking**: Monthly usage limits, keyed by `user_id` + `month` (YYYY-MM format)
- **analyses**: Stores analysis results with truncated image previews (not full images)
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
- `lib/supabase.ts`: Supabase client + TypeScript interfaces
- `lib/subscription-helpers.ts`: Subscription/usage query helpers
- `lib/regulatory-documents.ts`: Document fetching and context building
- `lib/export-helpers.ts`: PDF/CSV/JSON export utilities using jsPDF
- `lib/email-templates.ts`: HTML email template generation
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
- Admin routes (`/admin/documents`) require `role: "admin"` in Clerk public metadata
- Organization roles: owner, admin, member, viewer (stored in `organization_members`)
- RLS policies enforce data isolation between users/orgs

### Export Functionality
- PDF exports use `jspdf` + `jspdf-autotable` libraries
- Three formats: PDF (formatted report), CSV (spreadsheet), JSON (raw data)
- Exports are tracked in `analysis_exports` table
- Individual analysis PDFs vs. batch monthly reports supported

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
4. **RLS Policies**: All Supabase queries require proper user context for RLS to work.
5. **Webhook Timing**: User must exist in Supabase before other operations (Clerk webhook must fire first).
6. **Base64 Image Storage**: Only truncated preview stored, not full image data.

## Key Files to Reference

- `middleware.ts` - Route protection and public route configuration
- `app/api/analyze/route.ts` - Core AI analysis logic
- `lib/subscription-helpers.ts` - Usage and subscription queries
- `SETUP_GUIDE.md` - Comprehensive setup and testing documentation
