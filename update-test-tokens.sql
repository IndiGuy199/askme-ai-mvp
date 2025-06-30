-- Update test user tokens for testing
-- Run this to give the test user enough tokens for comprehensive testing

UPDATE users 
SET tokens = 5000 
WHERE email = 'deeshop9821@gmail.com';

-- Verify the update
SELECT 
  email,
  first_name,
  tokens,
  'Updated for testing' as status
FROM users 
WHERE email = 'deeshop9821@gmail.com';
