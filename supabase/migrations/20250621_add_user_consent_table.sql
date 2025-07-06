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

-- Enhanced user consent table with comprehensive tracking (for existing table)

-- Add new columns for enhanced tracking
ALTER TABLE public.user_consent 
ADD COLUMN IF NOT EXISTS browser_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS terms_text TEXT,
ADD COLUMN IF NOT EXISTS privacy_text TEXT,
ADD COLUMN IF NOT EXISTS medical_disclaimer_text TEXT,
ADD COLUMN IF NOT EXISTS consent_method TEXT DEFAULT 'web_form',
ADD COLUMN IF NOT EXISTS withdrawal_date TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS withdrawal_reason TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update consent_date to have a default if it doesn't already
ALTER TABLE public.user_consent 
ALTER COLUMN consent_date SET DEFAULT NOW();

-- Create additional indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_user_consent_active ON public.user_consent(is_active);
CREATE INDEX IF NOT EXISTS idx_user_consent_ip ON public.user_consent(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_consent_method ON public.user_consent(consent_method);
CREATE INDEX IF NOT EXISTS idx_user_consent_withdrawal ON public.user_consent(withdrawal_date) WHERE withdrawal_date IS NOT NULL;

-- Add admin policy for compliance reporting
CREATE POLICY "Service role can view all consent records" 
    ON public.user_consent FOR SELECT 
    USING (auth.role() = 'service_role');

-- Create consent text templates table for version management
CREATE TABLE IF NOT EXISTS public.consent_templates (
    id BIGSERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    terms_template TEXT NOT NULL,
    privacy_template TEXT NOT NULL,
    medical_disclaimer_template TEXT NOT NULL,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deprecated_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for consent templates
CREATE INDEX IF NOT EXISTS idx_consent_templates_version ON public.consent_templates(version);
CREATE INDEX IF NOT EXISTS idx_consent_templates_active ON public.consent_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_consent_templates_effective ON public.consent_templates(effective_date);

-- Enable RLS for consent templates
ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for consent templates
CREATE POLICY "Authenticated users can view active consent templates" 
    ON public.consent_templates FOR SELECT 
    USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Service role can manage consent templates" 
    ON public.consent_templates FOR ALL 
    USING (auth.role() = 'service_role');

-- Insert current consent templates (version 2.0)
INSERT INTO public.consent_templates (
    version, 
    terms_template, 
    privacy_template, 
    medical_disclaimer_template
) VALUES (
    '2.0',
    'I accept the Terms of Service and understand that AskMe AI provides wellness guidance and is not a substitute for professional medical, psychological, legal, or financial advice. I acknowledge that this service is for educational and wellness support purposes only.',
    'I accept the Privacy Policy and consent to the processing of my personal data for wellness coaching purposes. I understand how my data will be used, stored, and protected according to the privacy policy.',
    'I understand that AskMe AI is for educational and wellness support purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. If I am experiencing a mental health crisis, having thoughts of self-harm, or need immediate medical attention, I will contact emergency services immediately or call the National Suicide Prevention Lifeline at 988. I will always consult with qualified healthcare professionals for medical concerns.'
) ON CONFLICT (version) DO NOTHING;

-- Grant permissions for consent templates
GRANT SELECT ON public.consent_templates TO authenticated;
GRANT ALL ON public.consent_templates TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.consent_templates_id_seq TO service_role;

-- Create audit log table for consent events
CREATE TABLE IF NOT EXISTS public.consent_audit_log (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'consent_given', 'consent_withdrawn', 'consent_viewed', etc.
    event_details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_consent_audit_email 
        FOREIGN KEY (email) 
        REFERENCES public.users(email) 
        ON DELETE CASCADE
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_consent_audit_email ON public.consent_audit_log(email);
CREATE INDEX IF NOT EXISTS idx_consent_audit_timestamp ON public.consent_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_consent_audit_event_type ON public.consent_audit_log(event_type);

-- Enable RLS for audit log
ALTER TABLE public.consent_audit_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit log
CREATE POLICY "Users can view their own audit records" 
    ON public.consent_audit_log FOR SELECT 
    USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Service role can view all audit records" 
    ON public.consent_audit_log FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "System can insert audit records" 
    ON public.consent_audit_log FOR INSERT 
    WITH CHECK (true);

-- Grant permissions for audit log
GRANT SELECT ON public.consent_audit_log TO authenticated;
GRANT ALL ON public.consent_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.consent_audit_log_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.consent_audit_log_id_seq TO service_role;

-- Function to log consent events automatically
CREATE OR REPLACE FUNCTION log_consent_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log when consent is given
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.consent_audit_log (
            email, 
            event_type, 
            event_details, 
            ip_address, 
            user_agent
        ) VALUES (
            NEW.email,
            'consent_given',
            jsonb_build_object(
                'consent_version', NEW.consent_version,
                'consent_method', NEW.consent_method,
                'consent_id', NEW.id
            ),
            NEW.ip_address,
            NEW.user_agent
        );
        RETURN NEW;
    END IF;

    -- Log when consent is withdrawn
    IF TG_OP = 'UPDATE' AND OLD.is_active = true AND NEW.is_active = false THEN
        INSERT INTO public.consent_audit_log (
            email, 
            event_type, 
            event_details, 
            ip_address, 
            user_agent
        ) VALUES (
            NEW.email,
            'consent_withdrawn',
            jsonb_build_object(
                'consent_version', NEW.consent_version,
                'withdrawal_reason', NEW.withdrawal_reason,
                'withdrawal_date', NEW.withdrawal_date,
                'consent_id', NEW.id
            ),
            NEW.ip_address,
            NEW.user_agent
        );
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic consent event logging
DROP TRIGGER IF EXISTS trigger_log_consent_events ON public.user_consent;
CREATE TRIGGER trigger_log_consent_events
    AFTER INSERT OR UPDATE ON public.user_consent
    FOR EACH ROW
    EXECUTE FUNCTION log_consent_event();

-- Function to get current active consent template
CREATE OR REPLACE FUNCTION get_active_consent_template(template_version TEXT DEFAULT NULL)
RETURNS TABLE(
    version TEXT,
    terms_template TEXT,
    privacy_template TEXT,
    medical_disclaimer_template TEXT,
    effective_date TIMESTAMPTZ
) AS $$
BEGIN
    IF template_version IS NOT NULL THEN
        RETURN QUERY
        SELECT 
            ct.version,
            ct.terms_template,
            ct.privacy_template,
            ct.medical_disclaimer_template,
            ct.effective_date
        FROM public.consent_templates ct
        WHERE ct.version = template_version
        AND ct.is_active = true;
    ELSE
        RETURN QUERY
        SELECT 
            ct.version,
            ct.terms_template,
            ct.privacy_template,
            ct.medical_disclaimer_template,
            ct.effective_date
        FROM public.consent_templates ct
        WHERE ct.is_active = true
        ORDER BY ct.effective_date DESC
        LIMIT 1;
    END IF;
END;
$$ language 'plpgsql';

-- Grant execute permissions on the function
GRANT EXECUTE ON FUNCTION get_active_consent_template(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_consent_template(TEXT) TO service_role;

-- Update existing records to have default values for new columns
UPDATE public.user_consent 
SET 
    consent_method = 'web_form',
    is_active = true
WHERE consent_method IS NULL OR is_active IS NULL;

-- Create view for active consent records
CREATE OR REPLACE VIEW public.active_user_consent AS
SELECT 
    uc.*,
    ct.terms_template,
    ct.privacy_template,
    ct.medical_disclaimer_template
FROM public.user_consent uc
LEFT JOIN public.consent_templates ct ON uc.consent_version = ct.version
WHERE uc.is_active = true
AND uc.consent_accepted = true;

-- Grant permissions on the view
GRANT SELECT ON public.active_user_consent TO authenticated;
GRANT SELECT ON public.active_user_consent TO service_role;

-- Add comments for documentation
COMMENT ON TABLE public.user_consent IS 'Stores comprehensive user consent records with full audit trail';
COMMENT ON TABLE public.consent_templates IS 'Version-controlled consent text templates for legal compliance';
COMMENT ON TABLE public.consent_audit_log IS 'Audit trail for all consent-related events';
COMMENT ON COLUMN public.user_consent.browser_fingerprint IS 'Browser fingerprint for additional verification';
COMMENT ON COLUMN public.user_consent.terms_text IS 'Actual terms text shown to user at time of consent';
COMMENT ON COLUMN public.user_consent.privacy_text IS 'Actual privacy policy text shown to user';
COMMENT ON COLUMN public.user_consent.medical_disclaimer_text IS 'Actual medical disclaimer shown to user';
COMMENT ON COLUMN public.user_consent.consent_method IS 'Method used to obtain consent (web_form, api, email, etc.)';
COMMENT ON COLUMN public.user_consent.withdrawal_date IS 'Date when consent was withdrawn, if applicable';
COMMENT ON COLUMN public.user_consent.is_active IS 'Whether this consent record is currently active';

-- Create indexes for performance on new columns
CREATE INDEX IF NOT EXISTS idx_user_consent_fingerprint ON public.user_consent USING hash(browser_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_consent_text_search ON public.user_consent USING gin(to_tsvector('english', terms_text || ' ' || privacy_text));
