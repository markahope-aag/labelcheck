# Food Label Compliance Checker - Setup Guide

## Overview

This is a comprehensive SaaS application for analyzing food packaging labels for FDA and USDA regulatory compliance using AI.

## ✅ Completed Components

### 1. Database Schema (Supabase)
- **users** table: Stores user profiles synced with Clerk
- **subscriptions** table: Tracks subscription plans and billing status
- **usage_tracking** table: Monthly usage limits and tracking per user
- **analyses** table: Stores analysis results and history
- **regulatory_documents** table: Stores FDA/USDA regulations and guidelines
- **document_categories** table: Categorizes regulatory documents
- **user_settings** table: User preferences and notification settings
- **organizations** table: Team/organization accounts
- **organization_members** table: Team membership and roles
- **analysis_exports** table: Export history tracking
- Row Level Security (RLS) enabled on all tables
- Proper indexes for performance
- Full-text search on regulatory documents

### 2. Authentication (Clerk)
- Clerk integration configured
- Sign-in and sign-up pages created
- Middleware for route protection
- Clerk webhook handler for user sync (`/api/webhooks/clerk`)
- User button component

### 3. Payment Integration (Stripe)
- Stripe checkout session creation (`/api/create-checkout-session`)
- Stripe webhook handler for subscription events (`/api/webhooks/stripe`)
- Customer creation and management
- Subscription lifecycle handling
- Payment success/failure tracking

### 4. AI Analysis Integration (Anthropic)
- Image analysis API route (`/api/analyze`)
- Claude AI integration for label analysis
- Regulatory document context injection
- Compliance status evaluation
- Usage tracking and limits enforcement

### 5. Pages
- Landing page with hero, features, testimonials
- Pricing page with three-tier plans
- Dashboard with quick stats and recent analyses
- Analysis page with image upload and results
- History page with past analyses and export functionality
- Reports page with monthly analytics and statistics
- Settings page with user preferences
- Team page for organization and member management
- Billing page with subscription management
- Admin documents page for regulatory management

### 6. Helper Functions
- `lib/supabase.ts`: Supabase client configuration
- `lib/regulatory-documents.ts`: Document management helpers
- `lib/subscription-helpers.ts`: Subscription and usage helpers
- `lib/export-helpers.ts`: PDF, CSV, and JSON export functions
- `lib/email-templates.ts`: Email notification templates
- `lib/constants.ts`: App constants and configuration
- `lib/utils.ts`: General utility functions

### 7. Regulatory Document Management
- Admin interface for managing regulations
- Create, edit, and deactivate documents
- Search and filter by document type
- Support for multiple document types (federal laws, state regulations, guidelines)
- Version tracking and effective dates
- Active/inactive status management

### 8. Export & Reporting Features
- **PDF Export**: Professional formatted reports with branding
- **CSV Export**: Spreadsheet-compatible data export
- **JSON Export**: Raw data for custom integrations
- **Monthly Reports**: Analytics by month with statistics
- **Yearly Overview**: Aggregate statistics across years
- **Individual Analysis PDFs**: Detailed single product reports
- Export tracking in database

### 9. Team Collaboration
- **Organizations**: Multi-user team accounts
- **Role-Based Access**: Owner, Admin, Member, Viewer roles
- **Member Invitations**: Invite team members by email
- **Shared Analyses**: Organization-wide analysis access
- **Member Management**: Add/remove team members

### 10. User Settings & Preferences
- **Notification Preferences**: Email, analysis complete, team activity, weekly summaries
- **Export Defaults**: Set preferred export format
- **Theme Settings**: Light, dark, or system theme
- **Timezone Configuration**: Regional settings for dates
- Settings synced across devices

## 📋 Required Environment Variables

Create a `.env` file with the following variables:

### 1. Clerk (https://dashboard.clerk.com)
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
```

**Setup Steps:**
1. Create a new application in Clerk
2. Copy the Publishable and Secret keys from API Keys page
3. Create a webhook endpoint: `https://yourdomain.com/api/webhooks/clerk`
4. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
5. Copy the webhook signing secret

### 2. Anthropic (https://console.anthropic.com)
```env
ANTHROPIC_API_KEY=sk-ant-...
```

**Setup Steps:**
1. Create an account at console.anthropic.com
2. Generate an API key from the API Keys section
3. Copy and paste the key

### 3. Stripe (https://dashboard.stripe.com)
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_BASIC=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
```

**Setup Steps:**
1. Create a Stripe account and enable test mode
2. Copy Publishable and Secret keys from Developers > API Keys
3. Create three products with recurring prices:
   - Basic Plan: $9.99/month
   - Pro Plan: $29.99/month
   - Enterprise Plan: $99.99/month
4. Copy each price ID
5. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
6. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
7. Copy webhook signing secret

### 4. Resend (https://resend.com) - Optional
```env
RESEND_API_KEY=re_...
```

**Setup Steps:**
1. Create a Resend account
2. Generate an API key
3. Verify your domain (optional for testing)

### 5. App Configuration
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Change to your production URL when deploying.

### 6. Supabase (Already Configured)
```env
NEXT_PUBLIC_SUPABASE_URL=https://wtnhzvjjsesmzaerpsxl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The Supabase instance is already set up with:
- All required tables created
- Row Level Security enabled
- Sample regulatory documents loaded

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in all the keys as described above.

### 3. Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000`

### 4. Test the Application

#### Authentication Flow:
1. Visit `/sign-up` and create an account
2. Check Supabase `users` table - user should be created via webhook
3. Sign in and verify navigation works

#### Analysis Flow:
1. Upload a food label image on `/analyze`
2. View the AI analysis results with regulatory compliance
3. Check `analyses` table for saved results
4. Verify `usage_tracking` increments

#### Subscription Flow:
1. Go to `/pricing` and select a plan
2. Complete Stripe checkout (use test card: 4242 4242 4242 4242)
3. Verify webhook creates subscription in `subscriptions` table
4. Check `/billing` to see active subscription

## 🔧 Webhook Testing (Local Development)

### Stripe CLI Testing
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```

### Clerk Webhook Testing
Use ngrok or similar to expose local server:
```bash
ngrok http 3000
```
Then update Clerk webhook endpoint to the ngrok URL.

## 🎨 Admin Access

To manage regulatory documents, you need admin access:

1. In Clerk Dashboard, select a user
2. Go to "Metadata" tab
3. Add to "Public metadata":
```json
{
  "role": "admin"
}
```
4. Save changes
5. User can now access `/admin/documents`

## 📊 Database Tables Overview

### users
- Synced with Clerk via webhooks
- Stores Stripe customer ID
- Links to subscriptions and analyses

### subscriptions
- Tracks active/canceled subscriptions
- Stores Stripe subscription ID
- Contains plan tier and status
- Tracks billing period dates

### usage_tracking
- Monthly usage limits per user
- Analyses used vs. limit
- Auto-created/updated during analysis

### analyses
- Stores image metadata (name, truncated preview)
- Full AI analysis results (JSON)
- Compliance status and issue count
- Timestamp for history

### regulatory_documents
- FDA/USDA regulations and guidelines
- Full-text searchable content
- Version tracking and effective dates
- Active/inactive status

### user_settings
- User notification preferences
- Default export format
- Theme and appearance settings
- Timezone configuration

### organizations
- Team/company accounts
- Plan tier and billing settings
- Member count limits
- Created by user reference

### organization_members
- User-organization relationships
- Role assignments (owner, admin, member, viewer)
- Invitation tracking
- Join date tracking

### analysis_exports
- Export history tracking
- Format and file metadata
- User and organization references
- Export timestamp

## 🧪 Testing Checklist

### Core Functionality
- [ ] User can sign up and sign in
- [ ] User record created in database via webhook
- [ ] User can upload and analyze a label image
- [ ] Analysis results saved to database
- [ ] Usage counter increments correctly
- [ ] Usage limits are enforced
- [ ] User can subscribe to a plan (Stripe Checkout)
- [ ] Subscription created in database via webhook
- [ ] Usage limits update based on plan
- [ ] User can view analysis history
- [ ] Admin can manage regulatory documents
- [ ] Regulatory documents used in AI analysis

### Export & Reporting
- [ ] User can export analyses as PDF
- [ ] User can export analyses as CSV
- [ ] User can export analyses as JSON
- [ ] Monthly reports display correctly
- [ ] Yearly statistics are accurate
- [ ] Individual analysis PDFs generate properly
- [ ] Export tracking saved to database

### Team Features
- [ ] User can create an organization
- [ ] Owner can invite team members
- [ ] Member invitations work correctly
- [ ] Role-based permissions enforced
- [ ] Organization analyses are shared with team
- [ ] Members can be removed by admins/owners
- [ ] Organization settings persist

### User Settings
- [ ] Notification preferences save correctly
- [ ] Theme settings apply properly
- [ ] Default export format is used
- [ ] Timezone affects date displays
- [ ] Settings sync across sessions

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Important Deployment Steps:
1. Update `NEXT_PUBLIC_APP_URL` to production URL
2. Update Stripe webhook endpoint to production URL
3. Update Clerk webhook endpoint to production URL
4. Switch Stripe to live mode and update keys
5. Switch Clerk to production instance
6. Test complete user flow in production

## 🔒 Security Notes

- All webhook endpoints verify signatures
- RLS ensures users only see their own data
- Organization members can only access their org's data
- Role-based access control for team features
- Admin role required for regulatory document management
- API keys never exposed to client
- Stripe customer IDs linked securely
- Images not permanently stored (preview only)
- Email notifications contain no sensitive data

## 📈 Usage Limits by Plan

- **Basic**: 10 analyses/month
- **Pro**: 100 analyses/month
- **Enterprise**: Unlimited analyses

Limits reset monthly and are enforced at the API level.

## 🐛 Troubleshooting

### "User not found" error
- Ensure Clerk webhook is configured and firing
- Check Supabase `users` table for user record
- Verify webhook secret is correct

### Stripe webhook not working
- Check webhook endpoint URL is correct
- Verify webhook secret matches
- Use Stripe CLI to test locally
- Check webhook logs in Stripe Dashboard

### Analysis fails
- Verify Anthropic API key is valid
- Check usage limits haven't been exceeded
- Ensure user has active subscription (if required)
- Check Supabase RLS policies

### Admin page not accessible
- Verify user has `role: admin` in Clerk metadata
- Check middleware allows admin routes
- Verify RLS policies allow admin operations

## 💡 Optional Enhancements

The application is production-ready with all core features. Consider these optional additions:

1. **Mobile Applications**: Native iOS/Android apps
2. **Batch Analysis**: Upload and analyze multiple labels at once
3. **API Access**: REST API for Enterprise customer integrations
4. **Custom Branding**: White-label options for enterprise customers
5. **Advanced Analytics**: Trend analysis and predictive insights
6. **Label Templates**: Pre-built templates for common product types
7. **Audit Trail**: Detailed logging for compliance requirements
8. **Integration Hub**: Connect with ERP and PLM systems

## 📚 Documentation Links

- [Clerk Documentation](https://clerk.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 🎯 Feature Highlights

### Regulatory Document Management
- Centralized management of FDA/USDA regulations
- Easy updates as regulations change
- Version tracking and effective dates
- Full-text search capabilities
- Automatic injection into AI analysis

### Intelligent Analysis
- Claude AI powered analysis
- Regulatory compliance checking
- Specific violation identification
- Actionable recommendations
- Reference to specific regulations

### Export & Reporting
- Professional PDF reports with branding
- CSV and JSON export formats
- Monthly analytics and statistics
- Yearly trend analysis
- Individual product reports
- Export history tracking

### Team Collaboration
- Multi-user organizations
- Role-based access control (Owner, Admin, Member, Viewer)
- Team member invitations
- Shared analysis access
- Organization-wide settings

### User Experience
- Customizable notification preferences
- Theme customization (light/dark/system)
- Timezone support
- Default export format settings
- Settings sync across devices

### Complete SaaS Infrastructure
- User authentication and management
- Subscription billing and management
- Usage tracking and limits
- Webhook handling for automation
- Admin tools for management
- Email notifications
- Comprehensive security with RLS
