import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail } from '@/lib/resend';
import { generateTrialReminderEmail } from '@/lib/email-templates';
import { logger } from '@/lib/logger';
import { handleApiError, ConfigurationError } from '@/lib/error-handler';

/**
 * API endpoint to send trial reminder emails to users at 10 days
 * This should be called by a cron job or scheduled task
 *
 * Usage:
 * - Set up a cron job to call this endpoint daily
 * - Example: 0 10 * * * curl https://your-domain.com/api/send-trial-reminders
 */
export async function GET(request: NextRequest) {
  return handleTrialReminders(request);
}

export async function POST(request: NextRequest) {
  return handleTrialReminders(request);
}

async function handleTrialReminders(request: NextRequest) {
  try {
    // Verify this is called from a cron job or has proper authentication
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.RESEND_API_KEY) {
      throw new ConfigurationError('RESEND_API_KEY');
    }

    logger.info('Starting trial reminder email job');

    // Find users who:
    // 1. Have trial_start_date set
    // 2. Don't have active subscriptions
    // 3. Are exactly 10 days into their trial (for reminder email)
    const now = new Date();
    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Query for users at 10 days (with some tolerance for cron timing)
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, trial_start_date, clerk_user_id')
      .not('trial_start_date', 'is', null)
      .gte('trial_start_date', tenDaysAgo.toISOString().slice(0, 10)) // Started on or after 10 days ago
      .lt(
        'trial_start_date',
        new Date(tenDaysAgo.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      ); // Started before 12 days ago (2-day window)

    if (usersError) {
      logger.error('Error fetching users for trial reminders', { error: usersError });
      throw usersError;
    }

    if (!users || users.length === 0) {
      logger.info('No users found for trial reminder emails');
      return NextResponse.json({
        message: 'No users found for trial reminders',
        sent: 0,
      });
    }

    // Check which users don't have active subscriptions
    const userIds = users.map((u) => u.id);
    const { data: subscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('user_id')
      .in('user_id', userIds)
      .eq('status', 'active');

    const subscribedUserIds = new Set(subscriptions?.map((s) => s.user_id) || []);

    // Filter to only users without active subscriptions
    const trialUsers = users.filter((u) => !subscribedUserIds.has(u.id));

    logger.info(`Found ${trialUsers.length} users for trial reminder emails`);

    let sentCount = 0;
    let errorCount = 0;

    // Send reminder emails
    for (const user of trialUsers) {
      try {
        // Calculate days remaining
        const trialStart = new Date(user.trial_start_date);
        const daysSinceStart = Math.floor(
          (now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const daysRemaining = 14 - daysSinceStart;

        // Only send if exactly 10 days (with 1-day tolerance)
        if (daysSinceStart >= 9 && daysSinceStart <= 11) {
          const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/billing`;

          const emailHtml = generateTrialReminderEmail({
            daysRemaining,
            upgradeUrl,
          });

          await sendEmail({
            to: user.email,
            subject: `⏰ Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in your free trial`,
            html: emailHtml,
          });

          sentCount++;
          logger.info('Trial reminder email sent', {
            userId: user.id,
            email: user.email,
            daysRemaining,
          });
        }
      } catch (emailError) {
        errorCount++;
        logger.error('Failed to send trial reminder email', {
          error: emailError,
          userId: user.id,
          email: user.email,
        });
      }
    }

    logger.info('Trial reminder email job completed', {
      totalUsers: trialUsers.length,
      sent: sentCount,
      errors: errorCount,
    });

    return NextResponse.json({
      message: 'Trial reminder emails processed',
      totalUsers: trialUsers.length,
      sent: sentCount,
      errors: errorCount,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
