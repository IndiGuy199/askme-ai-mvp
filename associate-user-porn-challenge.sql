-- Associate rdee199@gmail.com with Pornography Addiction challenge

DO $$
DECLARE
  user_id_var UUID;
  porn_challenge_record_id UUID;
BEGIN
  -- Get user ID for rdee199@gmail.com
  SELECT id INTO user_id_var
  FROM users
  WHERE email = 'rdee199@gmail.com';
  
  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'User rdee199@gmail.com not found';
  END IF;
  
  -- Get the coach_challenge record ID for Pornography Addiction
  SELECT id INTO porn_challenge_record_id
  FROM coach_challenges
  WHERE label = 'Pornography Addiction'
  AND is_active = true;
  
  IF porn_challenge_record_id IS NULL THEN
    RAISE EXCEPTION 'Pornography Addiction challenge not found';
  END IF;
  
  -- Check if association already exists
  IF EXISTS (
    SELECT 1 FROM user_challenges
    WHERE user_id = user_id_var
    AND coach_challenge_id = porn_challenge_record_id
  ) THEN
    RAISE NOTICE 'User is already associated with Pornography Addiction challenge';
  ELSE
    -- Insert the association
    INSERT INTO user_challenges (user_id, coach_challenge_id)
    VALUES (user_id_var, porn_challenge_record_id);
    
    RAISE NOTICE 'Successfully associated user rdee199@gmail.com with Pornography Addiction challenge';
  END IF;
END $$;

-- Verify the association
SELECT 
  u.email,
  cc.label as challenge_label,
  cc.challenge_id,
  cc.coach_profile_id
FROM user_challenges uc
JOIN users u ON uc.user_id = u.id
JOIN coach_challenges cc ON uc.coach_challenge_id = cc.id
WHERE u.email = 'rdee199@gmail.com';
