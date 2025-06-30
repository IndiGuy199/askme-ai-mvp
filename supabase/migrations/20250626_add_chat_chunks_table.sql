-- Create chat_chunks table for storing chunked chat responses
CREATE TABLE chat_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  chunks JSONB NOT NULL, -- Array of chunk strings
  total_chunks INTEGER NOT NULL,
  current_chunk INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_chat_chunks_user_id ON chat_chunks(user_id);
CREATE INDEX idx_chat_chunks_conversation_id ON chat_chunks(conversation_id);
CREATE INDEX idx_chat_chunks_user_conversation ON chat_chunks(user_id, conversation_id);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_chunks ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to only access their own chunks
CREATE POLICY "Users can access their own chat chunks" ON chat_chunks
  FOR ALL USING (auth.uid() = user_id);

-- Add a function to clean up old chunks (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_chat_chunks()
RETURNS void AS $$
BEGIN
  DELETE FROM chat_chunks 
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create a cron job to run cleanup weekly (if pg_cron is available)
-- This will be commented out as pg_cron might not be available in all environments
-- SELECT cron.schedule('cleanup-chat-chunks', '0 2 * * 0', 'SELECT cleanup_old_chat_chunks();');
