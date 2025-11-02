import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      logger.error('Stripe webhook signature verification failed', { error: err.message });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId = session.metadata?.supabase_user_id;
        const planTier = session.metadata?.plan_tier;

        if (!supabaseUserId || !planTier) {
          logger.error('Missing metadata in Stripe checkout session', {
            sessionId: session.id,
            metadata: session.metadata,
          });
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

        await supabaseAdmin.from('subscriptions').insert({
          user_id: supabaseUserId,
          stripe_subscription_id: subscription.id,
          stripe_price_id: subscription.items.data[0].price.id,
          plan_tier: planTier,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        });

        const limits: Record<string, number> = {
          starter: 10,
          professional: 50,
          business: 200,
        };

        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabaseAdmin.from('usage_tracking').upsert(
          {
            user_id: supabaseUserId,
            month: currentMonth,
            analyses_used: 0,
            analyses_limit: limits[planTier] || 10,
          },
          { onConflict: 'user_id,month' }
        );

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
  } catch (error: any) {
    logger.error('Stripe webhook processing failed', { error, message: error.message });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
