-- Migration: Add action completion tracking tables
-- Created: 2025-07-03

-- Create action_completions table to track daily completions
CREATE TABLE IF NOT EXISTS action_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create action_deletions table to track deleted actions with completion history
CREATE TABLE IF NOT EXISTS action_deletions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_action_id UUID NOT NULL, -- Store the original action_plans ID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    goal_id TEXT,
    challenge_id TEXT,
    completion_count INTEGER DEFAULT 0,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_action_completions_action_id ON action_completions(action_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_user_id ON action_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_action_completions_completed_at ON action_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_action_deletions_user_id ON action_deletions(user_id);
CREATE INDEX IF NOT EXISTS idx_action_deletions_deleted_at ON action_deletions(deleted_at);

-- Add fully_complete column to action_plans if it doesn't exist
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS fully_complete BOOLEAN DEFAULT FALSE;

-- Add status column to action_plans if it doesn't exist (for suggested/accepted actions)
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted';

-- Add challenge_id column to action_plans if it doesn't exist
ALTER TABLE action_plans 
ADD COLUMN IF NOT EXISTS challenge_id TEXT;

-- Add RLS policies
ALTER TABLE action_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_deletions ENABLE ROW LEVEL SECURITY;

-- Policy for action_completions: users can only see their own completions
-- Note: user_id in action_completions refers to the users table id, not auth.uid()
CREATE POLICY "Users can view their own action completions" ON action_completions
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE email = auth.email()
        )
    );

-- Policy for action_deletions: users can only see their own deleted actions
-- Note: user_id in action_deletions refers to the users table id, not auth.uid()
CREATE POLICY "Users can view their own deleted actions" ON action_deletions
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE email = auth.email()
        )
    );
