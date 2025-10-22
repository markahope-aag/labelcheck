import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const results: any = {
    success: true,
    checks: [],
  };

  try {
    // Step 1: Get a test user
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .limit(1);

    results.checks.push({
      test: 'Fetch test user',
      passed: !userError && users && users.length > 0,
      error: userError?.message || null,
      user: users?.[0] || null,
    });

    if (userError || !users || users.length === 0) {
      results.success = false;
      return NextResponse.json(results, { status: 500 });
    }

    const testUser = users[0];

    // Step 2: Check recent analyses
    const { data: recentAnalyses, error: analysesError } = await supabaseAdmin
      .from('analyses')
      .select('id, session_id, created_at, image_name')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    results.checks.push({
      test: 'Fetch recent analyses',
      passed: !analysesError,
      error: analysesError?.message || null,
      count: recentAnalyses?.length || 0,
      analyses: recentAnalyses || [],
    });

    if (analysesError) {
      results.success = false;
    }

    // Step 3: Check for analyses with sessions
    const analysesWithSessions = recentAnalyses?.filter(a => a.session_id !== null) || [];

    results.checks.push({
      test: 'Analyses with sessions',
      passed: true,
      count: analysesWithSessions.length,
      note: analysesWithSessions.length === 0
        ? 'No analyses with sessions yet. Upload a label via UI to test.'
        : 'Found analyses with sessions',
    });

    // Step 4: If we have sessions, verify them
    if (analysesWithSessions.length > 0) {
      for (const analysis of analysesWithSessions) {
        // Check session exists
        const { data: session, error: sessionError } = await supabaseAdmin
          .from('analysis_sessions')
          .select('*')
          .eq('id', analysis.session_id)
          .maybeSingle();

        results.checks.push({
          test: `Session ${analysis.session_id} exists`,
          passed: !sessionError && !!session,
          error: sessionError?.message || null,
          session: session || null,
        });

        if (sessionError || !session) {
          results.success = false;
          continue;
        }

        // Check iterations
        const { data: iterations, error: iterError } = await supabaseAdmin
          .from('analysis_iterations')
          .select('*')
          .eq('session_id', analysis.session_id)
          .order('created_at', { ascending: true });

        results.checks.push({
          test: `Iterations for session ${analysis.session_id}`,
          passed: !iterError,
          error: iterError?.message || null,
          count: iterations?.length || 0,
          iterations: iterations || [],
        });

        if (iterError) {
          results.success = false;
        }
      }
    }

    results.summary = {
      totalAnalyses: recentAnalyses?.length || 0,
      analysesWithSessions: analysesWithSessions.length,
      sessionCreationWorking: analysesWithSessions.length > 0,
    };

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
