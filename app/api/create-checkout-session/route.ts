import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_PRICES } from '@/lib/constants';
import { logger, createRequestLogger } from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/create-checkout-session' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized checkout session request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestLogger.info('Checkout session creation started', { userId });

    const formData = await request.formData();
    const plan = formData.get('plan') as string;

    if (!plan || !['basic', 'pro', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Use admin client to bypass RLS
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          clerk_user_id: userId,
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Use admin client to update user
      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    const planPrices = PLAN_PRICES[plan as keyof typeof PLAN_PRICES];
    const stripePriceId = planPrices.stripePriceId;

    if (!stripePriceId) {
      return NextResponse.json({ error: 'Stripe Price ID not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      client_reference_id: user.id,
      metadata: {
        clerk_user_id: userId,
        supabase_user_id: user.id,
        plan_tier: plan,
      },
    });

    requestLogger.info('Checkout session created', {
      userId,
      plan,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    requestLogger.error('Checkout session creation failed', { error, message: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
