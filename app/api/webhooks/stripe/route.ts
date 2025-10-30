import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

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
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const supabaseUserId = session.metadata?.supabase_user_id;
        const planTier = session.metadata?.plan_tier;

        if (!supabaseUserId || !planTier) {
          console.error('Missing metadata in checkout session');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

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
        await supabaseAdmin
          .from('usage_tracking')
          .upsert(
            {
              user_id: supabaseUserId,
              month: currentMonth,
              analyses_used: 0,
              analyses_limit: limits[planTier] || 10,
            },
            { onConflict: 'user_id,month' }
          );

        console.log(`Subscription created for user: ${supabaseUserId}`);
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
          console.error('User not found for customer:', customerId);
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

        console.log(`Subscription updated for user: ${user.id}`);
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
          console.error('User not found for customer:', customerId);
          break;
        }

        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'canceled' })
          .eq('user_id', user.id)
          .eq('stripe_subscription_id', subscription.id);

        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabaseAdmin
          .from('usage_tracking')
          .upsert(
            {
              user_id: user.id,
              month: currentMonth,
              analyses_used: 0,
              analyses_limit: 5,
            },
            { onConflict: 'user_id,month' }
          );

        console.log(`Subscription canceled for user: ${user.id}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded for invoice:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed for invoice:', invoice.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
