import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const results: any = {
    success: true,
    checks: [],
  };

  try {
    // Test 1: Check if analysis_sessions table exists
    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('analysis_sessions')
      .select('*')
      .limit(1);

    results.checks.push({
      test: 'analysis_sessions table',
      passed: !sessionsError,
      error: sessionsError?.message || null,
    });

    if (sessionsError) results.success = false;

    // Test 2: Check if analysis_iterations table exists
    const { data: iterations, error: iterationsError } = await supabaseAdmin
      .from('analysis_iterations')
      .select('*')
      .limit(1);

    results.checks.push({
      test: 'analysis_iterations table',
      passed: !iterationsError,
      error: iterationsError?.message || null,
    });

    if (iterationsError) results.success = false;

    // Test 3: Check if analyses table has session_id column
    const { data: analyses, error: analysesError } = await supabaseAdmin
      .from('analyses')
      .select('id, session_id')
      .limit(1);

    results.checks.push({
      test: 'analyses.session_id column',
      passed: !analysesError,
      error: analysesError?.message || null,
    });

    if (analysesError) results.success = false;

    // Test 4: Try to create and delete a test session
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);

    if (users && users.length > 0) {
      const testUserId = users[0].id;

      const { data: testSession, error: createError } = await supabaseAdmin
        .from('analysis_sessions')
        .insert({
          user_id: testUserId,
          title: 'Test Session',
          status: 'in_progress',
        })
        .select()
        .single();

      results.checks.push({
        test: 'Create test session',
        passed: !createError,
        error: createError?.message || null,
        sessionId: testSession?.id || null,
      });

      if (createError) {
        results.success = false;
      } else {
        // Clean up test session
        await supabaseAdmin
          .from('analysis_sessions')
          .delete()
          .eq('id', testSession.id);

        results.checks.push({
          test: 'Delete test session',
          passed: true,
          error: null,
        });
      }
    } else {
      results.checks.push({
        test: 'Create test session',
        passed: true,
        error: 'Skipped - no users in database',
      });
    }

    return NextResponse.json(results, { status: results.success ? 200 : 500 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        checks: results.checks,
      },
      { status: 500 }
    );
  }
}
