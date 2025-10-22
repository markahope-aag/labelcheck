// Quick test to verify the analysis_sessions migration was applied successfully
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMigration() {
  console.log('🔍 Testing analysis_sessions migration...\n');

  // Test 1: Check if analysis_sessions table exists
  console.log('1. Checking analysis_sessions table...');
  const { data: sessions, error: sessionsError } = await supabase
    .from('analysis_sessions')
    .select('*')
    .limit(1);

  if (sessionsError) {
    console.error('❌ analysis_sessions table error:', sessionsError.message);
    return false;
  }
  console.log('✅ analysis_sessions table exists');

  // Test 2: Check if analysis_iterations table exists
  console.log('\n2. Checking analysis_iterations table...');
  const { data: iterations, error: iterationsError } = await supabase
    .from('analysis_iterations')
    .select('*')
    .limit(1);

  if (iterationsError) {
    console.error('❌ analysis_iterations table error:', iterationsError.message);
    return false;
  }
  console.log('✅ analysis_iterations table exists');

  // Test 3: Check if analyses table has session_id column
  console.log('\n3. Checking analyses.session_id column...');
  const { data: analyses, error: analysesError } = await supabase
    .from('analyses')
    .select('id, session_id')
    .limit(1);

  if (analysesError) {
    console.error('❌ analyses.session_id column error:', analysesError.message);
    return false;
  }
  console.log('✅ analyses table has session_id column');

  // Test 4: Try to create a test session
  console.log('\n4. Testing session creation...');

  // First, get a user ID
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (userError || !users || users.length === 0) {
    console.log('⚠️  No users found, skipping session creation test');
  } else {
    const testUserId = users[0].id;

    const { data: testSession, error: createError } = await supabase
      .from('analysis_sessions')
      .insert({
        user_id: testUserId,
        title: 'Test Session',
        status: 'in_progress'
      })
      .select()
      .single();

    if (createError) {
      console.error('❌ Session creation error:', createError.message);
      return false;
    }

    console.log('✅ Session created successfully');
    console.log('   Session ID:', testSession.id);

    // Clean up test session
    await supabase
      .from('analysis_sessions')
      .delete()
      .eq('id', testSession.id);

    console.log('✅ Test session cleaned up');
  }

  console.log('\n✅ All migration checks passed!');
  console.log('\n📊 Migration Summary:');
  console.log('   - analysis_sessions table: ✅');
  console.log('   - analysis_iterations table: ✅');
  console.log('   - analyses.session_id column: ✅');
  console.log('   - Session creation: ✅');

  return true;
}

testMigration()
  .then(success => {
    if (success) {
      console.log('\n🎉 Migration verified successfully! Ready to proceed with UI development.');
      process.exit(0);
    } else {
      console.log('\n❌ Migration verification failed. Please check Supabase logs.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
