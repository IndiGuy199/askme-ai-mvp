-- Add a function to safely create user profile if it doesn't exist
CREATE OR REPLACE FUNCTION create_user_profile_if_not_exists(p_user_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
  profile_exists BOOLEAN;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(
    SELECT 1 FROM user_profiles WHERE user_id = p_user_id
  ) INTO profile_exists;
  
  -- Create profile if it doesn't exist
  IF NOT profile_exists THEN
    INSERT INTO user_profiles (user_id, memory_summary, created_at, updated_at)
    VALUES (p_user_id, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
