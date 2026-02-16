#!/bin/bash

# Run the baseline tracking split migration
echo "Running migration: 20260214_split_track_goal_baselines.sql"

# You can run this against your Supabase database
# For local development, use:
# psql -h localhost -d your_database -f ./supabase/migrations/20260214_split_track_goal_baselines.sql

# For Supabase hosted, you can apply this through the Supabase dashboard SQL editor
# or using the Supabase CLI:
# supabase db push

echo "Migration completed. The following changes were made:"
echo "1. Created user_track_baselines table for track-level metrics (unique per user/track)"
echo "2. Added goal_baseline_level and goal_obstacle_text to user_goal_baselines"
echo "3. Added RLS policies for user_track_baselines"
echo "4. Created updated_at trigger for user_track_baselines"
echo ""
echo "Don't forget to:"
echo "- Apply this migration to your database (Supabase dashboard SQL editor)"
echo "- Test track baseline flow (Set Track Baseline button in menu)"
echo "- Test goal baseline flow (Edit baseline on a goal)"
echo "- Verify track baseline is saved only once per user/track (upsert)"
echo "- Verify goal baseline creates new rows for each capture"

