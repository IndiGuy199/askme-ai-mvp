-- Create user_consent table to store consent acceptance records
CREATE TABLE IF NOT EXISTS public.user_consent (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    consent_accepted BOOLEAN NOT NULL DEFAULT false,
    consent_date TIMESTAMPTZ NOT NULL,
    consent_version TEXT NOT NULL DEFAULT '1.0',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_user_consent_email 
        FOREIGN KEY (email) 
        REFERENCES public.users(email) 
        ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_consent_email ON public.user_consent(email);
CREATE INDEX IF NOT EXISTS idx_user_consent_date ON public.user_consent(consent_date);
CREATE INDEX IF NOT EXISTS idx_user_consent_version ON public.user_consent(consent_version);

-- Add RLS (Row Level Security)
ALTER TABLE public.user_consent ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own consent records" 
    ON public.user_consent FOR SELECT 
    USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert their own consent records" 
    ON public.user_consent FOR INSERT 
    WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update their own consent records" 
    ON public.user_consent FOR UPDATE 
    USING (auth.jwt() ->> 'email' = email)
    WITH CHECK (auth.jwt() ->> 'email' = email);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_user_consent_updated_at 
    BEFORE UPDATE ON public.user_consent 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.user_consent TO authenticated;
GRANT ALL ON public.user_consent TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_consent_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_consent_id_seq TO service_role;
