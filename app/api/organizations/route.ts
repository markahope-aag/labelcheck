import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user (throws if not authenticated or not found)
    const { userInternalId, userEmail } = await getAuthenticatedUser();

    // Create userData object for compatibility with existing code
    const userData = { id: userInternalId, email: userEmail };

    const { name, slug } = await req.json();

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Organization name and slug are required' },
        { status: 400 }
      );
    }

    // Check if user already belongs to an organization
    const { data: existingMembership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userData.id)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        { error: 'User already belongs to an organization' },
        { status: 400 }
      );
    }

    // Check if slug is already taken
    const { data: existingOrg } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingOrg) {
      return NextResponse.json({ error: 'Organization slug is already taken' }, { status: 400 });
    }

    // Create organization
    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name,
        slug,
        billing_email: userData.email,
        created_by: userData.id,
      })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // Add user as organization owner
    const { error: memberError } = await supabaseAdmin.from('organization_members').insert({
      organization_id: newOrg.id,
      user_id: userData.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      console.error('Error adding organization member:', memberError);
      // Rollback organization creation
      await supabaseAdmin.from('organizations').delete().eq('id', newOrg.id);

      return NextResponse.json({ error: 'Failed to add user to organization' }, { status: 500 });
    }

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error: any) {
    console.error('Error in organization creation:', error);

    // Handle auth errors with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'User not found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
