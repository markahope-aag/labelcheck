-- Performance Optimization: Fix auth.uid() re-evaluation in RLS policies
-- Wraps auth.uid() with (select auth.uid()) to prevent re-evaluation for each row

-- =====================================================
-- ANALYSIS_SESSIONS POLICIES
-- =====================================================

-- Drop and recreate policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON analysis_sessions;

CREATE POLICY "Users can view their own sessions"
    ON analysis_sessions FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own sessions"
    ON analysis_sessions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own sessions"
    ON analysis_sessions FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own sessions"
    ON analysis_sessions FOR DELETE
    TO authenticated
    USING (user_id = (select auth.uid()));

-- =====================================================
-- ANALYSIS_ITERATIONS POLICIES
-- =====================================================

-- Drop and recreate policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view iterations from their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can insert iterations to their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can update iterations in their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can delete iterations from their sessions" ON analysis_iterations;

CREATE POLICY "Users can view iterations from their sessions"
    ON analysis_iterations FOR SELECT
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can insert iterations to their sessions"
    ON analysis_iterations FOR INSERT
    TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can update iterations in their sessions"
    ON analysis_iterations FOR UPDATE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can delete iterations from their sessions"
    ON analysis_iterations FOR DELETE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

-- Comments for documentation
COMMENT ON POLICY "Users can view their own sessions" ON analysis_sessions
  IS 'Optimized: auth.uid() wrapped in select to prevent row-by-row re-evaluation';

COMMENT ON POLICY "Users can view iterations from their sessions" ON analysis_iterations
  IS 'Optimized: auth.uid() wrapped in select to prevent row-by-row re-evaluation';
