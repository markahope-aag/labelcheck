import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { PLAN_PRICES } from '@/lib/constants';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ExternalServiceError,
  ConfigurationError,
} from '@/lib/error-handler';

// Stripe client will be initialized after checking for key
let stripe: Stripe | null = null;

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/create-checkout-session' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized checkout session request');
      throw new AuthenticationError();
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new ConfigurationError('STRIPE_SECRET_KEY');
    }

    if (!stripe) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia',
      });
    }

    requestLogger.info('Checkout session creation started', { userId });

    const formData = await request.formData();
    const plan = formData.get('plan') as string;

    const validPlans = ['basic', 'pro', 'enterprise'];
    if (!plan || !validPlans.includes(plan)) {
      throw new ValidationError('Invalid plan selected', { plan, validPlans });
    }

    // Use admin client to bypass RLS
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      throw new NotFoundError('User', userId);
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
    const stripePriceId = planPrices?.stripePriceId;

    if (!stripePriceId) {
      throw new ValidationError('Invalid plan selected', { plan });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create({
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
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      throw new ExternalServiceError('Stripe', error);
    }

    requestLogger.info('Checkout session created', {
      userId,
      plan,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
