#!/bin/bash

# Run the goal activation system migration

echo "Running migration: 20260207_add_goal_activation_system.sql"

# Check if we're using local Supabase or cloud
if command -v supabase &> /dev/null; then
    # Local Supabase CLI
    echo "Using Supabase CLI..."
    supabase db push
else
    # Cloud Supabase - need to run manually via Supabase dashboard
    echo "Supabase CLI not found."
    echo "Please run this migration manually in your Supabase dashboard:"
    echo ""
    echo "1. Go to your Supabase project dashboard"
    echo "2. Navigate to SQL Editor"
    echo "3. Copy and paste the contents of:"
    echo "   supabase/migrations/20260207_add_goal_activation_system.sql"
    echo "4. Run the query"
    echo ""
    echo "Or install Supabase CLI: https://supabase.com/docs/guides/cli"
fi
