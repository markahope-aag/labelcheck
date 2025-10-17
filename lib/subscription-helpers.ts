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
    .select('id')
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

  const percentage =
    usage.analyses_limit === -1
      ? 0
      : Math.round((usage.analyses_used / usage.analyses_limit) * 100);

  const remaining =
    usage.analyses_limit === -1
      ? Infinity
      : Math.max(0, usage.analyses_limit - usage.analyses_used);

  return {
    analyses_used: usage.analyses_used,
    analyses_limit: usage.analyses_limit,
    percentage,
    remaining: remaining === Infinity ? -1 : remaining,
  };
}

export async function canUserAnalyze(userId: string): Promise<{ canAnalyze: boolean; reason?: string }> {
  const usage = await getUserUsage(userId);

  if (!usage) {
    return { canAnalyze: false, reason: 'Usage data not found' };
  }

  if (usage.analyses_limit === -1) {
    return { canAnalyze: true };
  }

  if (usage.analyses_used >= usage.analyses_limit) {
    return { canAnalyze: false, reason: 'Monthly analysis limit reached' };
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
