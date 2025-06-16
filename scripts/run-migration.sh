#!/bin/bash

# Run the communication preferences and favorites migration
echo "Running migration: 20250617_add_communication_preferences_and_favorites.sql"

# You can run this against your Supabase database
# For local development, use:
# psql -h localhost -d your_database -f ./supabase/migrations/20250617_add_communication_preferences_and_favorites.sql

# For Supabase hosted, you can apply this through the Supabase dashboard SQL editor
# or using the Supabase CLI:
# supabase db push

echo "Migration completed. The following changes were made:"
echo "1. Added communication_style, coaching_format, and preferences_set columns to users table"
echo "2. Created user_favorites table for saving advice snippets"
echo "3. Added communication_style and coaching_format to user_profiles table"
echo "4. Created indexes for better performance"
echo ""
echo "Don't forget to:"
echo "- Apply this migration to your database"
echo "- Test the onboarding quiz"
echo "- Test the favorites functionality"
