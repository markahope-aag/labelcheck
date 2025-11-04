import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { handleApiError, ValidationError, ConfigurationError } from '@/lib/error-handler';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new ConfigurationError('STRIPE_WEBHOOK_SECRET');
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      throw new ValidationError('Stripe signature header is required', {
        field: 'stripe-signature',
      });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('signature')) {
        throw new ValidationError('Invalid webhook signature');
      }
      throw err;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId = session.metadata?.supabase_user_id;
        const purchaseType = session.metadata?.purchase_type;

        // Handle bundle purchases (one-time payments)
        if (purchaseType === 'bundle') {
          const bundleSize = session.metadata?.bundle_size;
          const analysesCount = parseInt(session.metadata?.analyses_count || '0', 10);

          if (!supabaseUserId || !bundleSize || !analysesCount) {
            logger.error('Missing metadata in bundle purchase checkout session', {
              sessionId: session.id,
              metadata: session.metadata,
            });
            break;
          }

          // Get payment intent to verify payment succeeded
          const paymentIntentId = session.payment_intent as string;
          if (!paymentIntentId) {
            logger.error('No payment intent found in bundle purchase session', {
              sessionId: session.id,
            });
            break;
          }

          // Create bundle purchase record
          const { error: bundleError } = await supabaseAdmin.from('bundle_purchases').insert({
            user_id: supabaseUserId,
            analyses_count: analysesCount,
            price_paid: (session.amount_total || 0) / 100, // Convert from cents
            stripe_payment_intent_id: paymentIntentId,
            analyses_remaining: analysesCount, // Start with all analyses available
          });

          if (bundleError) {
            logger.error('Error creating bundle purchase', {
              error: bundleError,
              userId: supabaseUserId,
              sessionId: session.id,
            });
          } else {
            logger.info('Bundle purchase created from Stripe webhook', {
              userId: supabaseUserId,
              bundleSize,
              analysesCount,
              paymentIntentId,
            });
          }
          break;
        }

        // Handle subscription purchases (existing logic)
        const planTier = session.metadata?.plan_tier;

        if (!supabaseUserId || !planTier) {
          logger.error('Missing metadata in Stripe checkout session', {
            sessionId: session.id,
            metadata: session.metadata,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Use upsert to handle both new subscriptions and upgrades
        // If user already has a subscription, this will update it
        const { error: subscriptionError } = await supabaseAdmin.from('subscriptions').upsert(
          {
            user_id: supabaseUserId,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0].price.id,
            plan_tier: planTier,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          },
          { onConflict: 'stripe_subscription_id' }
        );

        if (subscriptionError) {
          logger.error('Error upserting subscription', {
            error: subscriptionError,
            userId: supabaseUserId,
            subscriptionId: subscription.id,
          });
        }

        // Clear trial_start_date when user upgrades (they're no longer on trial)
        await supabaseAdmin
          .from('users')
          .update({ trial_start_date: null })
          .eq('id', supabaseUserId);

        // Map plan tier from checkout (basic/pro/enterprise) to limits format (starter/professional/business)
        const planTierMap: Record<string, string> = {
          basic: 'starter',
          pro: 'professional',
          enterprise: 'business',
          starter: 'starter',
          professional: 'professional',
          business: 'business',
        };

        const mappedPlanTier = planTierMap[planTier] || 'starter';

        const limits: Record<string, number> = {
          starter: 10,
          professional: 50,
          business: 200,
        };

        const currentMonth = new Date().toISOString().slice(0, 7);

        // Get current usage to calculate remaining analyses from free trial
        // This bonus is only applied in the upgrade month - subsequent months
        // will reset to just the subscription limit (handled by checkUsageLimits)
        const { data: currentUsage } = await supabaseAdmin
          .from('usage_tracking')
          .select('analyses_used, analyses_limit')
          .eq('user_id', supabaseUserId)
          .eq('month', currentMonth)
          .maybeSingle();

        // Preserve current usage count (don't reset to 0)
        const preservedUsage = currentUsage?.analyses_used ?? 0;

        // Calculate remaining analyses from free trial (only in upgrade month)
        const previousLimit = currentUsage?.analyses_limit ?? 0;
        const remainingFromTrial = Math.max(0, previousLimit - preservedUsage);

        // New subscription limit
        const newSubscriptionLimit = limits[mappedPlanTier] || 10;

        // Total available = remaining from trial + new subscription limit
        // Example: 3 remaining from trial + 10 from Starter = 13 total in upgrade month
        // Note: In subsequent months, usage resets to 0 and limit is just subscription limit
        const totalAvailable = remainingFromTrial + newSubscriptionLimit;

        await supabaseAdmin.from('usage_tracking').upsert(
          {
            user_id: supabaseUserId,
            month: currentMonth,
            analyses_used: preservedUsage,
            analyses_limit: totalAvailable,
          },
          { onConflict: 'user_id,month' }
        );

        logger.info('Subscription created with preserved trial analyses', {
          userId: supabaseUserId,
          planTier: mappedPlanTier,
          preservedUsage,
          remainingFromTrial,
          newSubscriptionLimit,
          totalAvailable,
        });

        logger.info('Subscription created from Stripe webhook', {
          userId: supabaseUserId,
          planTier,
          subscriptionId: subscription.id,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!user) {
          logger.error('User not found for Stripe customer during subscription update', {
            customerId,
          });
          break;
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq('user_id', user.id)
          .eq('stripe_subscription_id', subscription.id);

        logger.info('Subscription updated from Stripe webhook', {
          userId: user.id,
          subscriptionId: subscription.id,
          status: subscription.status,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (!user) {
          logger.error('User not found for Stripe customer during subscription deletion', {
            customerId,
          });
          break;
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('user_id', user.id)
          .eq('stripe_subscription_id', subscription.id);

        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabaseAdmin.from('usage_tracking').upsert(
          {
            user_id: user.id,
            month: currentMonth,
            analyses_used: 0,
            analyses_limit: 5,
          },
          { onConflict: 'user_id,month' }
        );

        logger.info('Subscription canceled from Stripe webhook', {
          userId: user.id,
          subscriptionId: subscription.id,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.info('Stripe payment succeeded', {
          invoiceId: invoice.id,
          customerId: invoice.customer,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logger.warn('Stripe payment failed', {
          invoiceId: invoice.id,
          customerId: invoice.customer,
        });
        break;
      }

      default:
        logger.debug('Unhandled Stripe webhook event type', { eventType: event.type });
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
