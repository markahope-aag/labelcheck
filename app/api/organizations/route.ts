import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { logger, createRequestLogger } from '@/lib/logger';
import { handleApiError, ValidationError, handleSupabaseError } from '@/lib/error-handler';

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/organizations' });

  try {
    // Get authenticated user (throws if not authenticated or not found)
    const { userInternalId, userEmail } = await getAuthenticatedUser();

    requestLogger.info('Organization creation request started', { userId: userInternalId });

    // Create userData object for compatibility with existing code
    const userData = { id: userInternalId, email: userEmail };

    const { name, slug } = await req.json();

    if (!name) {
      throw new ValidationError('Organization name is required', { field: 'name' });
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
      throw handleSupabaseError(orgError, 'create organization');
    }

    // Add user as organization owner
    const { error: memberError } = await supabaseAdmin.from('organization_members').insert({
      organization_id: newOrg.id,
      user_id: userData.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

    if (memberError) {
      // Rollback organization creation
      await supabaseAdmin.from('organizations').delete().eq('id', newOrg.id);
      throw handleSupabaseError(memberError, 'add member to organization');
    }

    requestLogger.info('Organization created successfully', {
      userId: userData.id,
      organizationId: newOrg.id,
      name,
      slug,
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
