-- Migration: Fix RLS policies for action completion tracking
-- Created: 2025-07-03

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own action completions" ON action_completions;
DROP POLICY IF EXISTS "Users can view their own deleted actions" ON action_deletions;

-- Create correct policies that match user_id with users table id based on auth email
CREATE POLICY "Users can view their own action completions" ON action_completions
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE email = auth.email()
        )
    );

CREATE POLICY "Users can view their own deleted actions" ON action_deletions
    FOR ALL USING (
        user_id IN (
            SELECT id FROM users WHERE email = auth.email()
        )
    );
