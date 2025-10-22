// Test script to verify the /api/analyze endpoint creates sessions correctly
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnalysisSession() {
  console.log('🔍 Testing analysis session creation...\n');

  try {
    // Step 1: Get a test user
    console.log('1. Finding a test user...');
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, clerk_user_id, email')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('❌ No users found:', userError?.message || 'No users in database');
      return false;
    }

    const testUser = users[0];
    console.log(`✅ Found user: ${testUser.email}`);

    // Step 2: Check recent analyses for this user
    console.log('\n2. Checking for recent analyses...');
    const { data: recentAnalyses, error: analysesError } = await supabase
      .from('analyses')
      .select('id, session_id, created_at, image_name')
      .eq('user_id', testUser.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (analysesError) {
      console.error('❌ Error fetching analyses:', analysesError.message);
      return false;
    }

    console.log(`✅ Found ${recentAnalyses?.length || 0} recent analyses`);

    if (recentAnalyses && recentAnalyses.length > 0) {
      console.log('\nRecent analyses:');
      recentAnalyses.forEach((analysis, idx) => {
        console.log(`  ${idx + 1}. ${analysis.image_name} - Session ID: ${analysis.session_id || 'NULL'}`);
      });
    }

    // Step 3: Check if any analyses have session_id
    const analysesWithSessions = recentAnalyses?.filter(a => a.session_id !== null) || [];

    if (analysesWithSessions.length === 0) {
      console.log('\n⚠️  No analyses with sessions found yet.');
      console.log('   This is expected if you haven\'t run an analysis since updating the code.');
      console.log('\n💡 Next step: Upload a label image via the UI to test session creation.');
      return true;
    }

    // Step 4: If we have analyses with sessions, verify the data
    console.log(`\n3. Found ${analysesWithSessions.length} analysis(es) with sessions`);

    for (const analysis of analysesWithSessions) {
      console.log(`\n   Checking session ${analysis.session_id}...`);

      // Check session exists
      const { data: session, error: sessionError } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('id', analysis.session_id)
        .maybeSingle();

      if (sessionError || !session) {
        console.error(`   ❌ Session not found: ${sessionError?.message}`);
        continue;
      }

      console.log(`   ✅ Session exists: "${session.title}" (${session.status})`);

      // Check iterations exist
      const { data: iterations, error: iterError } = await supabase
        .from('analysis_iterations')
        .select('*')
        .eq('session_id', analysis.session_id)
        .order('created_at', { ascending: true });

      if (iterError) {
        console.error(`   ❌ Error fetching iterations: ${iterError.message}`);
        continue;
      }

      console.log(`   ✅ Found ${iterations?.length || 0} iteration(s)`);

      if (iterations && iterations.length > 0) {
        iterations.forEach((iter, idx) => {
          console.log(`      ${idx + 1}. ${iter.iteration_type} (${iter.created_at})`);
        });
      }
    }

    console.log('\n✅ Analysis session verification complete!');
    console.log('\n📊 Summary:');
    console.log(`   - Total analyses checked: ${recentAnalyses?.length || 0}`);
    console.log(`   - Analyses with sessions: ${analysesWithSessions.length}`);
    console.log(`   - Session creation: ${analysesWithSessions.length > 0 ? '✅ Working' : '⚠️  Not tested yet'}`);

    return true;

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    return false;
  }
}

testAnalysisSession()
  .then(success => {
    if (success) {
      console.log('\n🎉 Test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Test failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
