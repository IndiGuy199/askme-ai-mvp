// This script can be used to execute the SQL function creation
// Example usage: node setup-db-function.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

async function setupDatabaseFunction() {
  console.log('Setting up database function for user profile creation...');
  
  // Initialize Supabase client with admin role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE
  );
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('./create-user-profile-function.sql', 'utf8');
    
    // Execute the SQL via RPC or REST API
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error creating database function:', error);
    } else {
      console.log('Database function created successfully');
    }
  } catch (err) {
    console.error('Error setting up database function:', err);
  }
}

setupDatabaseFunction().catch(console.error);
