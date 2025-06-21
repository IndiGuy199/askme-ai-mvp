-- Fix the progress table schema to allow challenge-only records
-- This removes the NOT NULL constraint from goal_id

-- Step 1: Remove the NOT NULL constraint from goal_id
ALTER TABLE progress 
ALTER COLUMN goal_id DROP NOT NULL;

-- Step 2: Verify the change worked
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'progress' 
  AND table_schema = 'public'
  AND column_name IN ('goal_id', 'challenge_id')
ORDER BY column_name;

-- Step 3: Test inserting a challenge progress record
-- (Replace 'your-user-id' with an actual user ID from your users table)
/*
INSERT INTO progress (user_id, challenge_id, progress_percent, last_updated)
VALUES ('your-user-id', 'test_challenge', 25, now());
*/
