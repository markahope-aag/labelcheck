import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import type { WebhookEvent } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  ConfigurationError,
  handleSupabaseError,
} from '@/lib/error-handler';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new ConfigurationError('CLERK_WEBHOOK_SECRET');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred - missing svix headers', {
      status: 400,
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('signature')) {
      throw new ValidationError('Invalid webhook signature');
    }
    throw err;
  }

  const eventType = evt.type;

  try {
    if (eventType === 'user.created') {
      // Type guard: user.created events have UserJSON data
      const userData = evt.data as {
        id: string;
        email_addresses?: Array<{ id: string; email_address: string }>;
        primary_email_address_id?: string;
      };
      const { id, email_addresses, primary_email_address_id } = userData;

      const primaryEmail = email_addresses?.find((email) => email.id === primary_email_address_id);

      const { data: newUser, error } = await supabaseAdmin
        .from('users')
        .insert({
          clerk_user_id: id,
          email: primaryEmail?.email_address || '',
          trial_start_date: new Date().toISOString(), // Set trial start date on user creation
        })
        .select()
        .single();

      if (error) {
        throw handleSupabaseError(error, 'create user from Clerk webhook');
      }

      if (newUser) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabaseAdmin.from('usage_tracking').insert({
          user_id: newUser.id,
          month: currentMonth,
          analyses_used: 0,
          analyses_limit: 10, // Free trial: 10 analyses (enough for 3-5 products + revisions)
        });
      }

      logger.info('User created from Clerk webhook', {
        clerkUserId: id,
        supabaseUserId: newUser.id,
      });
    }

    if (eventType === 'user.updated') {
      // Type guard: user.updated events have UserJSON data
      const userData = evt.data as {
        id: string;
        email_addresses?: Array<{ id: string; email_address: string }>;
        primary_email_address_id?: string;
      };
      const { id, email_addresses, primary_email_address_id } = userData;

      const primaryEmail = email_addresses?.find((email) => email.id === primary_email_address_id);

      const { error } = await supabaseAdmin
        .from('users')
        .update({
          email: primaryEmail?.email_address || '',
          updated_at: new Date().toISOString(),
        })
        .eq('clerk_user_id', id);

      if (error) {
        throw handleSupabaseError(error, 'update user from Clerk webhook');
      }

      logger.info('User updated from Clerk webhook', { clerkUserId: id });
    }

    if (eventType === 'user.deleted') {
      // Type guard: user.deleted events have DeletedObjectJSON data
      const deletedData = evt.data as { id: string };
      const { id } = deletedData;

      const { error } = await supabaseAdmin.from('users').delete().eq('clerk_user_id', id);

      if (error) {
        throw handleSupabaseError(error, 'delete user from Clerk webhook');
      }

      logger.info('User deleted from Clerk webhook', { clerkUserId: id });
    }

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
