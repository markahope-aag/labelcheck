# Logging Migration Guide for Cursor

## Phase 1: Setup (COMPLETED by Claude Code)
✅ Installed pino and pino-pretty dependencies
✅ Created lib/logger.ts with configuration
✅ Updated 3 example files to demonstrate patterns

## Phase 2: Bulk Replacements (FOR CURSOR)

### Pattern Examples

**Example 1: Simple Error Logging (lib/image-processing.ts)**
```typescript
// BEFORE
console.error('Error preprocessing image:', error);

// AFTER
import { logger } from '@/lib/logger';
logger.error('Image preprocessing failed', { error, bufferSize: buffer.length });
```

**Example 2: API Route with Request Context (app/api/analyze/text/route.ts)**
```typescript
// BEFORE
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    // ...
    console.log('=== AI Text Analysis Response ===');
    console.error('Error parsing AI response:', parseError);
  } catch (error: any) {
    console.error('Error analyzing text content:', error);
  }
}

// AFTER
import { logger, createRequestLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/text' });

  try {
    const { userId } = await auth();
    requestLogger.info('Text analysis request started', { userId });
    // ...
    requestLogger.debug('AI response received', { responseLength: responseText.length });
    requestLogger.error('Failed to parse AI response', { error: parseError });
  } catch (error: any) {
    requestLogger.error('Text analysis failed', { error, message: error.message });
  }
}
```

**Example 3: Helper Function (lib/gras-helpers.ts)**
```typescript
// BEFORE
if (error) {
  console.error('Error searching GRAS ingredients:', error);
  return [];
}

// AFTER
import { logger } from './logger';

if (error) {
  logger.error('GRAS ingredient search failed', { error, query, limit });
  return [];
}
```

### Replacement Rules

1. **Import Statement**
   - Add at top of file: `import { logger } from '@/lib/logger';`
   - For API routes: `import { logger, createRequestLogger } from '@/lib/logger';`

2. **Log Level Mapping**
   - `console.error()` → `logger.error()`
   - `console.warn()` → `logger.warn()`
   - `console.log()` → `logger.info()` or `logger.debug()`
   - `console.info()` → `logger.info()`
   - `console.debug()` → `logger.debug()`

3. **Message Format**
   - First parameter: Short, descriptive message (no interpolation)
   - Second parameter: Structured data object with context

   ```typescript
   // ❌ BAD
   console.log(`Processing ${userId} with ${count} items`);

   // ✅ GOOD
   logger.info('Processing user items', { userId, count });
   ```

4. **API Routes: Use Request Logger**
   ```typescript
   const requestLogger = createRequestLogger({
     endpoint: '/api/analyze',
     userId: userId // if available
   });
   ```

5. **Never Log Sensitive Data**
   - ❌ Passwords, API keys, tokens
   - ❌ Full email addresses
   - ❌ Credit card numbers
   - ✅ User IDs (UUIDs), status codes, performance metrics

### Files to Update (Production Code Only)

#### 🔴 HIGH PRIORITY - Core API Routes (20 files)
These handle user requests and must be updated first:

```
app/api/analyze/route.ts
app/api/analyze/chat/route.ts
app/api/analyze/select-category/route.ts
app/api/analyze/check-quality/route.ts
app/api/share/route.ts
app/api/create-checkout-session/route.ts
app/api/accept-invitation/route.ts
app/api/webhooks/clerk/route.ts
app/api/webhooks/stripe/route.ts
app/api/organizations/route.ts
app/api/organizations/members/route.ts
app/api/organizations/invitations/[id]/route.ts
app/api/admin/stats/route.ts
app/api/admin/users/route.ts
app/api/admin/users/[id]/route.ts
app/api/admin/users/[id]/toggle-admin/route.ts
app/api/admin/subscriptions/route.ts
app/api/admin/documents/route.ts
app/api/admin/documents/[id]/route.ts
app/api/admin/documents/extract-pdf/route.ts
app/api/admin/documents/categories/route.ts
```

#### 🟡 MEDIUM PRIORITY - Helper Libraries (8 files)
Core business logic used by API routes:

```
lib/regulatory-documents.ts
lib/pdf-helpers.ts
lib/ndi-helpers.ts
lib/performance-monitor.ts
lib/config.ts
lib/resend.ts
lib/regulatory-cache.ts
lib/auth-helpers.ts
lib/analysis/orchestrator.ts
lib/analysis/post-processor.ts
lib/prompt-loader.ts
```

#### 🟢 LOW PRIORITY - Frontend Components (6 files)
UI components with minimal console usage:

```
components/navigation.tsx
components/TextChecker.tsx
components/AnalysisChat.tsx
app/analyze/page.tsx
app/analysis/[id]/page.tsx
app/team/page.tsx
app/share/[token]/page.tsx
app/settings/page.tsx
app/reports/page.tsx
app/history/page.tsx
app/pricing/page.tsx
app/error.tsx
app/accept-invitation/page.tsx
```

### ⚠️ Files to SKIP
Do NOT update these files (test scripts, migrations, documentation):

```
*.md (all markdown files)
test-*.js (all test scripts)
check-*.js (check/audit scripts)
scripts/*.js (development scripts)
*-migration.js (database migration scripts)
scrape-*.js (data scraping scripts)
import-*.js (data import scripts)
setup-*.js (setup scripts)
verify-*.js (verification scripts)
```

### Step-by-Step Instructions for Cursor

1. **Open Cursor Composer** (Cmd/Ctrl+I)

2. **Add Files to Context**
   - Start with HIGH PRIORITY files (API routes)
   - Add 5-10 files at a time to Composer
   - Reference this guide and the 3 example files

3. **Use This Prompt**:
   ```
   Please update the console.log/error/warn calls in these files to use the new structured logging system.

   Follow the patterns shown in:
   - lib/logger.ts (the logging utility)
   - lib/image-processing.ts (simple error logging)
   - app/api/analyze/text/route.ts (API route with request context)
   - lib/gras-helpers.ts (helper function logging)

   Apply these rules:
   1. Import logger or createRequestLogger from '@/lib/logger'
   2. For API routes, create a requestLogger at the start
   3. Convert console.error → logger.error with structured data
   4. Convert console.log → logger.info or logger.debug
   5. Use descriptive messages + data objects (not string interpolation)
   6. Never log sensitive data (passwords, tokens, full emails)

   Make the changes across all files in the context.
   ```

4. **Review Changes**
   - Check that imports are correct
   - Verify structured data format is used
   - Ensure no sensitive data is being logged

5. **Repeat for Each Priority Group**
   - High → Medium → Low

6. **When Complete**
   - Notify the user
   - Commit with message: "feat: migrate to structured logging with Pino"

### Verification Checklist

After Cursor completes the work, verify:
- [ ] All `console.*` calls replaced in production code
- [ ] Imports added correctly (`@/lib/logger`)
- [ ] API routes use `createRequestLogger()`
- [ ] Structured data format used (not string interpolation)
- [ ] No sensitive data being logged
- [ ] Code compiles (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)

---

## Phase 3: Review & Finalization (Claude Code will handle)
- Review all changes
- Run typecheck and build
- Update TECHNICAL_DEBT.md
- Commit and push
