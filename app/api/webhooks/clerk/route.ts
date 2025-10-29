import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env');
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

  let evt: any;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', {
      status: 400,
    });
  }

  const eventType = evt.type;
  const { id, email_addresses, primary_email_address_id } = evt.data;

  try {
    if (eventType === 'user.created') {
      const primaryEmail = email_addresses?.find(
        (email: any) => email.id === primary_email_address_id
      );

      const { data: newUser, error } = await supabaseAdmin.from('users').insert({
        clerk_user_id: id,
        email: primaryEmail?.email_address || '',
      }).select().single();

      if (error) {
        console.error('Error creating user in database:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
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

      console.log(`User created: ${id}`);
    }

    if (eventType === 'user.updated') {
      const primaryEmail = email_addresses?.find(
        (email: any) => email.id === primary_email_address_id
      );

      const { error } = await supabaseAdmin
        .from('users')
        .update({
          email: primaryEmail?.email_address || '',
          updated_at: new Date().toISOString(),
        })
        .eq('clerk_user_id', id);

      if (error) {
        console.error('Error updating user in database:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      console.log(`User updated: ${id}`);
    }

    if (eventType === 'user.deleted') {
      const { error } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('clerk_user_id', id);

      if (error) {
        console.error('Error deleting user from database:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      console.log(`User deleted: ${id}`);
    }

    return NextResponse.json({ message: 'Webhook processed successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
