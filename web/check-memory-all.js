const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

async function checkAllMemorySummaries() {
  // Create a Supabase client with the service role key for admin access
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );

  console.log('Checking all user profiles for memory summaries...');
  
  // First, get all users
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, first_name');
  
  if (userError) {
    console.error('Error fetching users:', userError);
    return;
  }
  
  console.log(`Found ${users.length} users`);
  
  // Then check each user's profile
  for (const user of users) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, memory_summary, updated_at')
      .eq('user_id', user.id)
      .single();
    
    if (profileError) {
      console.log(`❌ No profile found for user ${user.email} (${user.id}): ${profileError.message}`);
      continue;
    }
    
    const memoryStatus = profile.memory_summary 
      ? `✅ Has memory (${profile.memory_summary.length} chars, updated: ${profile.updated_at})`
      : '❌ Empty memory';
    
    console.log(`User: ${user.email} (${user.first_name || 'Unknown'}) - ${memoryStatus}`);
    
    // Check if there are chat messages for this user
    const { data: messages, error: msgError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    
    if (msgError) {
      console.log(`  Error checking messages: ${msgError.message}`);
      continue;
    }
    
    const hasMessages = messages && messages.length > 0;
    console.log(`  ${hasMessages ? '✅ Has chat messages' : '❌ No chat messages'}`);
    
    // Count total messages
    if (hasMessages) {
      const { count, error: countError } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id);
      
      if (!countError) {
        console.log(`  Total messages: ${count}`);
      }
    }
    
    console.log('');
  }
}

checkAllMemorySummaries().catch(console.error);
