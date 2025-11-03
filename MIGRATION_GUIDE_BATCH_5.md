# Batch 5: Webhook Handlers Migration Guide

**Files:** 2 webhook handler files
**Total Instances:** 6
**Time Estimate:** 20 minutes
**Priority:** HIGH - Critical integration endpoints (Clerk auth + Stripe payments)

---

## File 1: app/api/webhooks/clerk/route.ts (4 instances)

### Import Addition

Add these imports at the top (after existing imports around line 5):

```typescript
import type { WebhookEvent } from '@clerk/nextjs/server';
```

---

### Fix 1: Line 30 - Webhook Event Type

```typescript
// BEFORE
  let evt: any;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;

// AFTER
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
```

**Explanation:** Clerk provides a `WebhookEvent` type that describes the structure of webhook events. This gives us autocomplete for `evt.type`, `evt.data`, etc.

---

### Fix 2: Line 51 - Email Find Callback

```typescript
// BEFORE
      const primaryEmail = email_addresses?.find(
        (email: any) => email.id === primary_email_address_id
      );

// AFTER
      const primaryEmail = email_addresses?.find(
        (email) => email.id === primary_email_address_id
      );
```

**Explanation:** TypeScript can infer the email type from the `email_addresses` array structure in `WebhookEvent`

---

### Fix 3: Line 86 - Another Email Find Callback

```typescript
// BEFORE (in user.updated handler)
      const primaryEmail = email_addresses?.find(
        (email: any) => email.id === primary_email_address_id
      );

// AFTER
      const primaryEmail = email_addresses?.find(
        (email) => email.id === primary_email_address_id
      );
```

---

### Fix 4: Line 117 - Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Clerk webhook processing failed', { error, eventType });
    return new Response('Webhook handler failed', {
      status: 500,
    });
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Clerk webhook processing failed', { error, eventType });
    return new Response('Webhook handler failed', {
      status: 500,
    });
  }
```

---

## File 2: app/api/webhooks/stripe/route.ts (2 instances)

### Fix 5: Line 25 - Webhook Verification Error Handler

```typescript
// BEFORE
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed', { error: err.message });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

// AFTER
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Stripe webhook signature verification failed', { error: error.message });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
```

**Note:** Need to update the logger call to use `error.message` instead of `err.message`

---

### Fix 6: Line 182 - Main Error Handler

```typescript
// BEFORE
  } catch (error: any) {
    logger.error('Stripe webhook processing failed', {
      error: error.message,
      type: event?.type,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }

// AFTER
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Stripe webhook processing failed', {
      error: error.message,
      type: event?.type,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
```

---

## Summary of Changes

### Clerk Webhook (4 fixes):
1. ✅ `evt: any` → `evt: WebhookEvent` (proper Clerk type)
2. ✅ Email find callback (line 51): Type inference
3. ✅ Email find callback (line 86): Type inference
4. ✅ Error handler (line 117): Type guard pattern

### Stripe Webhook (2 fixes):
1. ✅ Signature verification error (line 25): Type guard + fix logger
2. ✅ Main error handler (line 182): Type guard

---

## Required Imports

**app/api/webhooks/clerk/route.ts:**
```typescript
import type { WebhookEvent } from '@clerk/nextjs/server';
```

**app/api/webhooks/stripe/route.ts:**
- No new imports needed (Stripe types already available)

---

## Verification

After making all changes:

```bash
npm run typecheck
```

Should pass with 0 errors!

---

## Why This Matters - Webhook Security

### Before (unsafe):
```typescript
let evt: any;
evt = wh.verify(...) as any;

// No type safety - could access invalid properties
evt.foo.bar.baz // ❌ Compiles but crashes
evt.type // Works but no autocomplete
evt.data.some_field // No validation
```

### After (type-safe):
```typescript
let evt: WebhookEvent;
evt = wh.verify(...) as WebhookEvent;

// Full type safety
evt.foo // ✅ Compile error - property doesn't exist
evt.type // ✅ Autocomplete shows valid event types
evt.data // ✅ Typed based on event type
```

### Real Impact:
- ✅ **Clerk webhooks:** Autocomplete for user.created, user.updated, user.deleted events
- ✅ **Stripe webhooks:** Type-safe access to session, subscription, invoice data
- ✅ **Error handling:** Won't crash on unexpected webhook payloads
- ✅ **Debugging:** IDE shows exactly what properties are available

**These are critical endpoints** - they handle:
- User account creation/sync (Clerk)
- Payment processing (Stripe)
- Subscription lifecycle (Stripe)

Type safety prevents production failures during payment flows! 💳

---

## Quick Checklist

**Clerk webhook:**
- [ ] Add `WebhookEvent` import
- [ ] Replace `evt: any` with `evt: WebhookEvent`
- [ ] Remove `: any` from 2 email find callbacks (type inference)
- [ ] Fix error handler with type guard

**Stripe webhook:**
- [ ] Fix signature verification error handler
- [ ] Update logger to use `error.message`
- [ ] Fix main error handler with type guard

**Total time:** ~20 minutes for all 6 instances

After this batch, **Phase 2 (API Routes) is COMPLETE!** 🎉
