-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  coach_profile_id UUID REFERENCES coach_profiles(id),
  tokens INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now()
);

-- coach_profiles table
CREATE TABLE coach_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  brand_theme JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);

-- promotions table
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_percent INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

-- welcome token trigger
CREATE OR REPLACE FUNCTION grant_welcome_tokens()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users SET tokens = 20 WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_signup
AFTER INSERT ON users
FOR EACH ROW EXECUTE PROCEDURE grant_welcome_tokens();
EOL
