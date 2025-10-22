import { supabase, supabaseAdmin } from './supabase';
import type { AnalysisSession, AnalysisIteration, SessionStatus, IterationType } from './supabase';

/**
 * Create a new analysis session for iterative compliance improvement
 */
export async function createSession(
  userId: string,
  title?: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisSession | null; error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { data, error } = await client
    .from('analysis_sessions')
    .insert({
      user_id: userId,
      title: title || null,
      status: 'in_progress',
    })
    .select()
    .single();

  return { data, error };
}

/**
 * Get a session by ID with all its iterations
 */
export async function getSessionWithIterations(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{
  session: AnalysisSession | null;
  iterations: AnalysisIteration[];
  error: any;
}> {
  const client = useAdmin ? supabaseAdmin : supabase;

  // Get session
  const { data: session, error: sessionError } = await client
    .from('analysis_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { session: null, iterations: [], error: sessionError };
  }

  // Get iterations ordered by creation time
  const { data: iterations, error: iterationsError } = await client
    .from('analysis_iterations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return {
    session,
    iterations: iterations || [],
    error: iterationsError,
  };
}

/**
 * Get all sessions for a user
 */
export async function getUserSessions(
  userId: string,
  status?: SessionStatus,
  useAdmin: boolean = false
): Promise<{ data: AnalysisSession[]; error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  let query = client
    .from('analysis_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  return { data: data || [], error };
}

/**
 * Add an iteration to a session
 */
export async function addIteration(
  sessionId: string,
  iterationType: IterationType,
  inputData: any,
  resultData?: any,
  analysisId?: string,
  parentIterationId?: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration | null; error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { data, error } = await client
    .from('analysis_iterations')
    .insert({
      session_id: sessionId,
      iteration_type: iterationType,
      input_data: inputData,
      result_data: resultData || null,
      analysis_id: analysisId || null,
      parent_iteration_id: parentIterationId || null,
    })
    .select()
    .single();

  // Update session's updated_at timestamp
  if (data && !error) {
    await client
      .from('analysis_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  return { data, error };
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  useAdmin: boolean = false
): Promise<{ error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { error } = await client
    .from('analysis_sessions')
    .update({ status })
    .eq('id', sessionId);

  return { error };
}

/**
 * Update session title
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string,
  useAdmin: boolean = false
): Promise<{ error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { error } = await client
    .from('analysis_sessions')
    .update({ title })
    .eq('id', sessionId);

  return { error };
}

/**
 * Get the latest iteration for a session
 */
export async function getLatestIteration(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration | null; error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { data, error } = await client
    .from('analysis_iterations')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

/**
 * Get iterations by type for a session
 */
export async function getIterationsByType(
  sessionId: string,
  iterationType: IterationType,
  useAdmin: boolean = false
): Promise<{ data: AnalysisIteration[]; error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { data, error } = await client
    .from('analysis_iterations')
    .select('*')
    .eq('session_id', sessionId)
    .eq('iteration_type', iterationType)
    .order('created_at', { ascending: true });

  return { data: data || [], error };
}

/**
 * Count issues/warnings across all iterations in a session
 * to track improvement progress
 */
export async function getSessionComplianceProgress(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{
  initialIssues: number;
  currentIssues: number;
  resolved: boolean;
}> {
  const client = useAdmin ? supabaseAdmin : supabase;

  const { data: iterations } = await client
    .from('analysis_iterations')
    .select('result_data, iteration_type')
    .eq('session_id', sessionId)
    .in('iteration_type', ['image_analysis', 'text_check', 'revised_analysis'])
    .order('created_at', { ascending: true });

  if (!iterations || iterations.length === 0) {
    return { initialIssues: 0, currentIssues: 0, resolved: false };
  }

  // Count issues from first analysis
  const firstResult = iterations[0].result_data;
  const initialIssues = countIssuesInResult(firstResult);

  // Count issues from last analysis
  const lastResult = iterations[iterations.length - 1].result_data;
  const currentIssues = countIssuesInResult(lastResult);

  return {
    initialIssues,
    currentIssues,
    resolved: currentIssues === 0,
  };
}

/**
 * Helper function to count issues in an analysis result
 */
function countIssuesInResult(result: any): number {
  if (!result) return 0;

  let issueCount = 0;

  // Count critical and high priority recommendations
  if (result.recommendations && Array.isArray(result.recommendations)) {
    issueCount += result.recommendations.filter(
      (rec: any) => rec.priority === 'critical' || rec.priority === 'high'
    ).length;
  }

  // Count non-compliant items
  const checkCompliance = (item: any) => {
    if (item && typeof item === 'object') {
      if (item.status === 'non_compliant' || item.status === 'potentially_non_compliant') {
        issueCount++;
      }
    }
  };

  if (result.general_labeling) {
    Object.values(result.general_labeling).forEach(checkCompliance);
  }
  if (result.ingredient_labeling) {
    checkCompliance(result.ingredient_labeling);
  }
  if (result.allergen_labeling) {
    checkCompliance(result.allergen_labeling);
  }
  if (result.nutrition_labeling) {
    checkCompliance(result.nutrition_labeling);
  }

  return issueCount;
}

/**
 * Delete a session and all its iterations
 */
export async function deleteSession(
  sessionId: string,
  useAdmin: boolean = false
): Promise<{ error: any }> {
  const client = useAdmin ? supabaseAdmin : supabase;

  // Cascade delete will handle iterations
  const { error } = await client
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);

  return { error };
}
