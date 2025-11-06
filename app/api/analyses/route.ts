import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';

/**
 * GET /api/analyses
 * Fetch user's analyses with optional filters
 * Uses supabaseAdmin to bypass RLS (user already authenticated by Clerk)
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Supabase user ID from Clerk ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ analyses: [], totalCount: 0 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const statusFilter = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sort') || 'date-desc';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query
    let query = supabaseAdmin
      .from('analyses')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Apply date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'compliant') {
        query = query.or(
          'compliance_status.eq.compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.likely_compliant'
        );
      } else if (statusFilter === 'non-compliant') {
        query = query.or(
          'compliance_status.eq.major_violations,analysis_result->overall_assessment->>primary_compliance_status.eq.non_compliant,analysis_result->overall_assessment->>primary_compliance_status.eq.potentially_non_compliant'
        );
      } else {
        query = query.eq('compliance_status', statusFilter);
      }
    }

    // Apply sorting
    if (sortBy === 'date-desc') {
      query = query.order('created_at', { ascending: false });
    } else if (sortBy === 'date-asc') {
      query = query.order('created_at', { ascending: true });
    }

    // Apply pagination
    const from = page * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: analyses, count, error } = await query;

    if (error) {
      logger.error('Failed to fetch analyses', { error, userId });
      return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 });
    }

    return NextResponse.json({
      analyses: analyses || [],
      totalCount: count || 0,
    });
  } catch (error) {
    logger.error('Unexpected error in GET /api/analyses', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/analyses/:id
 * Delete a specific analysis
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get analysis ID from query params
    const analysisId = request.nextUrl.searchParams.get('id');

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    }

    // Get Supabase user ID from Clerk ID
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete the analysis (ensure it belongs to the user)
    const { error } = await supabaseAdmin
      .from('analyses')
      .delete()
      .eq('id', analysisId)
      .eq('user_id', user.id);

    if (error) {
      logger.error('Failed to delete analysis', { error, analysisId, userId });
      return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Unexpected error in DELETE /api/analyses', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
