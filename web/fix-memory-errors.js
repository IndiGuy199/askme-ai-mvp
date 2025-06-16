// This script fixes memory summarization issues by identifying and repairing corrupted user profiles

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function main() {
  const email = process.argv[2];
  
  if (!email) {
    console.log('Usage: node fix-memory-errors.js [email]');
    console.log('If email is provided, only that user will be fixed. Otherwise, all users will be checked.');
    
    const checkAll = await promptYesNo('Would you like to check all users instead? (y/n)');
    if (!checkAll) {
      process.exit(0);
    }
  }
  
  console.log('\n=== Memory Error Repair Utility ===\n');
  
  try {
    // Step 1: Get users to fix
    let users;
    if (email) {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name')
        .eq('email', email)
        .single();
        
      if (error || !data) {
        console.error('Error finding user with email', email, error);
        process.exit(1);
      }
      
      users = [data];
      console.log(`Found user: ${data.first_name || 'Unknown'} (${data.email})`);
    } else {
      // Get all users
      const { data, error } = await supabase
        .from('users')
        .select('id, email, first_name');
        
      if (error) {
        console.error('Error fetching users:', error);
        process.exit(1);
      }
      
      users = data;
      console.log(`Found ${users.length} users to check`);
    }
    
    // Step 2: Process each user
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      console.log(`\nProcessing ${user.first_name || 'Unknown'} (${user.email})...`);
        try {
        // First check for duplicate profiles - this could be causing constraint violations
        const { data: duplicateCheck, error: dupError } = await supabase
          .from('user_profiles')
          .select('id, user_id')
          .eq('user_id', user.id);
          
        if (dupError) {
          console.error('  - Error checking for duplicates:', dupError);
        } else if (duplicateCheck.length > 1) {
          // Found duplicate profiles - this is a problem we need to fix
          console.log(`  - FOUND ${duplicateCheck.length} DUPLICATE PROFILES for user ${user.email}`);
          
          // Keep the most recently updated profile
          const { data: profiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, user_id, memory_summary, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
            
          if (profilesError) {
            console.error('  - Error fetching detailed profiles:', profilesError);
            errorCount++;
          } else {
            // Keep the first one (most recently updated) and delete the rest
            const keepProfile = profiles[0];
            const deleteProfiles = profiles.slice(1);
            
            console.log(`  - Keeping profile ID ${keepProfile.id} updated at ${keepProfile.updated_at}`);
            console.log(`  - Deleting ${deleteProfiles.length} duplicate profiles`);
            
            for (const profile of deleteProfiles) {
              const { error: deleteError } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', profile.id);
                
              if (deleteError) {
                console.error(`  - Failed to delete duplicate profile ${profile.id}:`, deleteError);
                errorCount++;
              } else {
                console.log(`  - Successfully deleted duplicate profile ${profile.id}`);
                fixedCount++;
              }
            }
          }
          
          continue; // Skip regular profile check since we've handled duplicates
        }
        
        // Check for user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, memory_summary, updated_at')
          .eq('user_id', user.id)
          .single();
        
        if (profileError) {
          if (profileError.code === 'PGRST116') { // Not found
            console.log('  - No profile found, creating new profile');
            
            // Create a new profile
            const { error: createError } = await supabase
              .from('user_profiles')
              .insert([{
                user_id: user.id,
                memory_summary: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]);
              
            if (createError) {
              console.error('  - Failed to create profile:', createError);
              errorCount++;
            } else {
              console.log('  - Successfully created empty profile');
              fixedCount++;
            }
          } else {
            console.error('  - Error fetching profile:', profileError);
            errorCount++;
          }
        } else {
          // Profile exists, check if memory summary is valid
          console.log(`  - Found profile, memory_summary length: ${profile.memory_summary?.length || 0}`);
          console.log(`  - Last updated: ${profile.updated_at}`);
          
          // Nothing to fix, everything looks good
          console.log('  - Profile appears valid, no action needed');
        }
      } catch (err) {
        console.error(`  - Exception processing user ${user.email}:`, err);
        errorCount++;
      }
    }
    
    console.log('\n=== Repair Summary ===');
    console.log(`Processed ${users.length} users`);
    console.log(`Fixed ${fixedCount} profiles`);
    console.log(`Encountered ${errorCount} errors`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function promptYesNo(question) {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(`${question} `, answer => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

main().catch(console.error);
