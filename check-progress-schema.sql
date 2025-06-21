-- Check the schema for the progress table
-- Run these queries in your Supabase SQL editor or psql

-- 1. Check the table structure and column definitions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'progress' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check constraints on the progress table
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  cc.column_name,
  pgc.consrc as constraint_definition
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage cc 
  ON tc.constraint_name = cc.constraint_name
LEFT JOIN pg_constraint pgc 
  ON pgc.conname = tc.constraint_name
WHERE tc.table_name = 'progress' 
  AND tc.table_schema = 'public';

-- 3. Check indexes on the progress table
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'progress' 
  AND schemaname = 'public';

-- 4. Alternative simpler query to see the table structure
\d progress

-- 5. Check if there are any records in the progress table and their structure
SELECT * FROM progress LIMIT 5;

-- 6. Check the specific NOT NULL constraints
SELECT 
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'progress' 
  AND table_schema = 'public'
  AND is_nullable = 'NO';
