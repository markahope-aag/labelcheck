# Trial Reminder Email Cron Job Setup

This document explains how to set up the automated trial reminder email system.

## Overview

The system sends reminder emails to users who are 10 days into their 14-day free trial. The email reminds them that they have 4 days remaining and provides an upgrade link.

## Setup Steps

### 1. Add Environment Variable

Add the `CRON_SECRET` environment variable to your Vercel project:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Generate a secure random string (e.g., `openssl rand -hex 32`)
   - **Environment**: Production, Preview, Development (as needed)

**Important**: Keep this secret secure. It's used to authenticate cron job requests.

### 2. Vercel Cron Job (Recommended)

If you're using Vercel, the cron job is already configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/send-trial-reminders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

**Schedule**: `0 10 * * *` means the job runs daily at 10:00 AM UTC.

**To customize the schedule:**
- Edit `vercel.json`
- Update the `schedule` field using [cron syntax](https://crontab.guru/)
- Examples:
  - `0 10 * * *` - Daily at 10:00 AM UTC
  - `0 9 * * 1` - Every Monday at 9:00 AM UTC
  - `0 */6 * * *` - Every 6 hours

**After updating `vercel.json`:**
1. Commit and push the changes
2. Vercel will automatically deploy the new cron configuration
3. You can verify it's working in the Vercel dashboard under **Settings** → **Cron Jobs**

### 3. Alternative: External Cron Service

If you're not using Vercel or want more control, you can use an external cron service:

#### Option A: EasyCron / Cron-job.org

1. Sign up for a cron service (e.g., [EasyCron](https://www.easycron.com/) or [cron-job.org](https://cron-job.org/))
2. Create a new cron job:
   - **URL**: `https://your-domain.com/api/send-trial-reminders`
   - **Method**: `GET` or `POST`
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule**: `0 10 * * *` (daily at 10:00 AM UTC)
3. Save and activate

#### Option B: Server Cron (Linux/Mac)

If you have server access, add to your crontab:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 10:00 AM UTC)
0 10 * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/send-trial-reminders
```

Replace `YOUR_CRON_SECRET` with the value from your environment variable.

### 4. Testing

**Test the endpoint manually:**

```bash
# Using curl
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/send-trial-reminders

# Or using the Vercel CLI (if CRON_SECRET is set in your env)
vercel env pull
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/send-trial-reminders
```

**Expected response:**
```json
{
  "message": "Trial reminder emails processed",
  "totalUsers": 5,
  "sent": 3,
  "errors": 0
}
```

**Test in development:**
1. Create a test user
2. Manually set their `trial_start_date` to 10 days ago:
   ```sql
   UPDATE users 
   SET trial_start_date = NOW() - INTERVAL '10 days'
   WHERE email = 'test@example.com';
   ```
3. Call the endpoint
4. Check that the email was sent

### 5. Monitoring

**Check logs:**
- Vercel: Dashboard → **Deployments** → Click on a deployment → **Functions** → `/api/send-trial-reminders`
- Or check your application logs for messages like:
  - `Starting trial reminder email job`
  - `Found X users for trial reminder emails`
  - `Trial reminder email sent`

**Monitor email delivery:**
- Check Resend dashboard for email delivery status
- Verify users receive emails at the expected time

## Troubleshooting

**Problem**: Endpoint returns 401 Unauthorized
- **Solution**: Verify `CRON_SECRET` is set correctly in environment variables
- Check that the Authorization header matches: `Bearer YOUR_CRON_SECRET`

**Problem**: No emails are being sent
- **Solution**: 
  - Check that `RESEND_API_KEY` is set
  - Verify users exist with `trial_start_date` set to ~10 days ago
  - Check that users don't have active subscriptions
  - Review application logs for errors

**Problem**: Cron job not running
- **Solution**:
  - Verify `vercel.json` is committed and deployed
  - Check Vercel dashboard → Settings → Cron Jobs to see if it's active
  - For external cron services, verify the job is enabled and scheduled correctly

## Security Notes

- The `CRON_SECRET` should be a strong, random string
- Never commit `CRON_SECRET` to version control
- Use environment variables for all secrets
- The endpoint will return 401 if `CRON_SECRET` is set but doesn't match
- If `CRON_SECRET` is not set, the endpoint will still work (for development only - not recommended for production)

## Schedule Recommendation

**Recommended**: Daily at 10:00 AM UTC (`0 10 * * *`)
- Gives users time to see the email during business hours (in most timezones)
- Runs once per day to avoid duplicate emails
- The endpoint itself checks for users at exactly 10 days (with 1-day tolerance)

You can adjust the schedule based on your user base's timezone preferences.

