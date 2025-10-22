-- Create analysis_sessions table for tracking iterative compliance improvement workflows
CREATE TABLE IF NOT EXISTS analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'resolved', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_iterations table for tracking each step in the improvement process
CREATE TABLE IF NOT EXISTS analysis_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    iteration_type TEXT NOT NULL CHECK (iteration_type IN ('image_analysis', 'text_check', 'chat_question', 'revised_analysis')),
    input_data JSONB NOT NULL,
    result_data JSONB,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    parent_iteration_id UUID REFERENCES analysis_iterations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add session_id to analyses table to link analyses to sessions
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user_id ON analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON analysis_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_iterations_session_id ON analysis_iterations(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_analysis_id ON analysis_iterations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_parent_iteration_id ON analysis_iterations(parent_iteration_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_created_at ON analysis_iterations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_session_id ON analyses(session_id);

-- Create updated_at trigger for analysis_sessions
CREATE OR REPLACE FUNCTION update_analysis_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analysis_sessions_updated_at
    BEFORE UPDATE ON analysis_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_sessions_updated_at();

-- Enable Row Level Security
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_iterations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analysis_sessions
CREATE POLICY "Users can view their own sessions"
    ON analysis_sessions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
    ON analysis_sessions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
    ON analysis_sessions FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
    ON analysis_sessions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies for analysis_iterations
CREATE POLICY "Users can view iterations from their sessions"
    ON analysis_iterations FOR SELECT
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert iterations to their sessions"
    ON analysis_iterations FOR INSERT
    TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update iterations in their sessions"
    ON analysis_iterations FOR UPDATE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete iterations from their sessions"
    ON analysis_iterations FOR DELETE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE analysis_sessions IS 'Tracks iterative compliance improvement workflows for label analyses';
COMMENT ON TABLE analysis_iterations IS 'Records each step in the iterative improvement process (analyses, text checks, chat questions)';
COMMENT ON COLUMN analysis_sessions.status IS 'Current status: in_progress (active work), resolved (compliant), archived (completed/dismissed)';
COMMENT ON COLUMN analysis_iterations.iteration_type IS 'Type of iteration: image_analysis, text_check, chat_question, revised_analysis';
COMMENT ON COLUMN analysis_iterations.input_data IS 'JSONB containing the input for this iteration (image reference, text content, or chat message)';
COMMENT ON COLUMN analysis_iterations.result_data IS 'JSONB containing the AI analysis result or chat response';
COMMENT ON COLUMN analysis_iterations.parent_iteration_id IS 'Links to parent iteration for threaded conversations or follow-ups';
