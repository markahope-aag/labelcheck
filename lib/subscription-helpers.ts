import { supabase } from './supabase';

export interface SubscriptionInfo {
  id: string;
  plan_tier: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface UsageInfo {
  analyses_used: number;
  analyses_limit: number;
  percentage: number;
  remaining: number;
  bundle_credits?: number; // Remaining bundle analyses
  total_available?: number; // subscription limit + bundle credits
  trial_days_remaining?: number | null; // Days remaining in trial (null if not on trial)
  trial_expired?: boolean; // Whether trial has expired
}

export async function getUserSubscription(userId: string): Promise<SubscriptionInfo | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!user) return null;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  return subscription;
}

export async function getUserUsage(userId: string): Promise<UsageInfo | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, trial_start_date')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!user) return null;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!usage) return null;

  // Check if user has active subscription
  const subscriptionStatus = await getSubscriptionStatus(userId);
  const isOnTrial = !subscriptionStatus.hasActiveSubscription;

  // Calculate trial days remaining if on trial
  let trialDaysRemaining: number | null = null;
  let trialExpired = false;
  if (isOnTrial && user.trial_start_date) {
    const trialStart = new Date(user.trial_start_date);
    const now = new Date();
    const daysSinceStart = Math.floor(
      (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysRemaining = 14 - daysSinceStart;
    trialDaysRemaining = Math.max(0, daysRemaining);
    trialExpired = daysRemaining <= 0;
  }

  // Get remaining bundle credits (analyses purchased but not yet used)
  // Gracefully handle if bundle_purchases table doesn't exist yet
  let bundleCredits = 0;
  try {
    const { data: bundles, error: bundleError } = await supabase
      .from('bundle_purchases')
      .select('analyses_remaining')
      .eq('user_id', user.id)
      .gt('analyses_remaining', 0);

    if (bundleError) {
      // Table might not exist yet - silently fail and return 0 credits
      console.warn('Bundle purchases query failed (table may not exist):', bundleError);
    } else {
      bundleCredits = bundles?.reduce((sum, b) => sum + b.analyses_remaining, 0) || 0;
    }
  } catch (err) {
    // Table doesn't exist or other error - return 0 credits
    console.warn('Bundle purchases query error:', err);
  }

  // Total available = subscription limit + bundle credits
  const totalAvailable =
    usage.analyses_limit === -1 ? Infinity : usage.analyses_limit + bundleCredits;

  // Calculate percentage based on subscription limit (not including bundles)
  const percentage =
    usage.analyses_limit === -1
      ? 0
      : Math.round((usage.analyses_used / usage.analyses_limit) * 100);

  // Remaining = subscription limit - used + bundle credits
  const subscriptionRemaining =
    usage.analyses_limit === -1
      ? Infinity
      : Math.max(0, usage.analyses_limit - usage.analyses_used);

  const totalRemaining =
    subscriptionRemaining === Infinity ? Infinity : subscriptionRemaining + bundleCredits;

  return {
    analyses_used: usage.analyses_used,
    analyses_limit: usage.analyses_limit,
    percentage,
    remaining: subscriptionRemaining === Infinity ? -1 : subscriptionRemaining,
    bundle_credits: bundleCredits,
    total_available: totalAvailable === Infinity ? -1 : totalAvailable,
    trial_days_remaining: trialDaysRemaining ?? undefined,
    trial_expired: trialExpired,
  };
}

export async function canUserAnalyze(
  userId: string
): Promise<{ canAnalyze: boolean; reason?: string }> {
  const usage = await getUserUsage(userId);

  if (!usage) {
    return { canAnalyze: false, reason: 'Usage data not found' };
  }

  // Check if trial has expired
  if (usage.trial_expired) {
    return {
      canAnalyze: false,
      reason: 'Your free trial has expired. Please upgrade to continue analyzing labels.',
    };
  }

  if (usage.analyses_limit === -1) {
    return { canAnalyze: true };
  }

  // Check if subscription limit is reached
  if (usage.analyses_used >= usage.analyses_limit) {
    // Check if user has bundle credits
    if (usage.bundle_credits && usage.bundle_credits > 0) {
      return { canAnalyze: true }; // Can use bundle credits
    }
    return {
      canAnalyze: false,
      reason: 'Monthly analysis limit reached. Purchase an analysis bundle or upgrade your plan.',
    };
  }

  return { canAnalyze: true };
}

export async function getSubscriptionStatus(userId: string): Promise<{
  hasActiveSubscription: boolean;
  planTier: string;
  status: string;
}> {
  const subscription = await getUserSubscription(userId);

  if (!subscription) {
    return {
      hasActiveSubscription: false,
      planTier: 'basic',
      status: 'none',
    };
  }

  return {
    hasActiveSubscription: subscription.status === 'active',
    planTier: subscription.plan_tier,
    status: subscription.status,
  };
}

export async function incrementUsage(userId: string): Promise<void> {
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!user) return;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const { data: usage } = await supabase
    .from('usage_tracking')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!usage) return;

  await supabase
    .from('usage_tracking')
    .update({ analyses_used: usage.analyses_used + 1 })
    .eq('user_id', user.id)
    .eq('month', currentMonth);
}

export function getPlanLimits(planTier: string): number {
  const limits: Record<string, number> = {
    basic: 10,
    pro: 100,
    enterprise: -1,
  };

  return limits[planTier] || 5;
}

export function formatPlanName(planTier: string): string {
  const names: Record<string, string> = {
    basic: 'Basic',
    pro: 'Professional',
    enterprise: 'Enterprise',
  };

  return names[planTier] || 'Free';
}

export function formatPlanPrice(planTier: string): string {
  const prices: Record<string, string> = {
    basic: '$9.99/month',
    pro: '$29.99/month',
    enterprise: '$99.99/month',
  };

  return prices[planTier] || 'Free';
}
