/**
 * Check for duplicate user profiles
 * 
 * This script checks for any users that have multiple profile records in the database,
 * which could cause constraint violations when updating memory summaries.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function checkDuplicateProfiles() {
  console.log('Checking for duplicate user profiles...');
  
  try {
    // Query to find users with multiple profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, count')
      .select('user_id')
      .csv(`
        SELECT user_id, COUNT(*) as profile_count
        FROM user_profiles
        GROUP BY user_id
        HAVING COUNT(*) > 1
      `, { count: 'exact' });
      
    if (error) {
      console.error('Error checking for duplicates:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('✅ No duplicate profiles found! Database is in good shape.');
      return;
    }
    
    console.log(`⚠️ Found ${data.length} users with duplicate profiles:`);
    
    // Get details for each user with duplicates
    for (const { user_id } of data) {
      // Get user info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email, first_name')
        .eq('id', user_id)
        .single();
        
      if (userError) {
        console.log(`  - User ID: ${user_id} (Error getting user details: ${userError.message})`);
        continue;
      }
      
      // Get profile details
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, updated_at')
        .eq('user_id', user_id);
        
      if (profileError) {
        console.log(`  - User: ${userData.first_name || 'Unknown'} (${userData.email})`);
        console.log(`    Error getting profile details: ${profileError.message}`);
        continue;
      }
      
      console.log(`  - User: ${userData.first_name || 'Unknown'} (${userData.email})`);
      console.log(`    Has ${profiles.length} profiles:`);
      
      profiles.forEach((profile, index) => {
        console.log(`    ${index + 1}. ID: ${profile.id}, Updated: ${profile.updated_at}`);
      });
    }
    
    console.log('\nTo fix these issues, run:');
    console.log('  node fix-memory-errors.js');
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkDuplicateProfiles().catch(console.error);
