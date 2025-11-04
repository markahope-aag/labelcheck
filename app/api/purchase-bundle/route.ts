import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { BUNDLE_SIZES } from '@/lib/constants';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ExternalServiceError,
  ConfigurationError,
} from '@/lib/error-handler';

let stripe: Stripe | null = null;

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/purchase-bundle' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized bundle purchase request');
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

    requestLogger.info('Bundle purchase checkout started', { userId });

    const formData = await request.formData();
    const bundleSize = formData.get('bundleSize') as string;

    const validSizes = ['small', 'medium', 'large'];
    if (!bundleSize || !validSizes.includes(bundleSize)) {
      throw new ValidationError('Invalid bundle size selected', {
        bundleSize,
        validSizes,
      });
    }

    const bundle = BUNDLE_SIZES[bundleSize as keyof typeof BUNDLE_SIZES];
    if (!bundle.stripePriceId) {
      throw new ConfigurationError('STRIPE_PRICE_ID_BUNDLE_' + bundleSize.toUpperCase());
    }

    // Get user
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

      await supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create checkout session for one-time payment
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: bundle.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'payment', // One-time payment, not subscription
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=bundle`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=bundle`,
        client_reference_id: user.id,
        metadata: {
          clerk_user_id: userId,
          supabase_user_id: user.id,
          bundle_size: bundleSize,
          analyses_count: bundle.analyses.toString(),
          purchase_type: 'bundle',
        },
      });
    } catch (stripeError) {
      const error = stripeError instanceof Error ? stripeError : new Error(String(stripeError));
      throw new ExternalServiceError('Stripe', error);
    }

    requestLogger.info('Bundle purchase checkout session created', {
      userId,
      bundleSize,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
