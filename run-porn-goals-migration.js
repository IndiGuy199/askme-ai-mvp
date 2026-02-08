const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('📦 Reading migration file...')
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260206_add_porn_coach_goals.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('🚀 Running migration: Add porn coach goals...')
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql })
    
    if (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }
    
    console.log('✅ Migration completed successfully!')
    
    // Verify the goals were inserted
    console.log('\n🔍 Verifying inserted goals...')
    const { data: goals, error: verifyError } = await supabase
      .from('coach_wellness_goals')
      .select(`
        label,
        category,
        display_order,
        coach_profiles!inner(code)
      `)
      .eq('coach_profiles.code', 'porn_coach')
      .order('display_order')
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError)
    } else {
      console.log(`\n✅ Found ${goals.length} porn coach goals:`)
      goals.forEach((goal, index) => {
        console.log(`  ${index + 1}. ${goal.label} (${goal.category})`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

runMigration()
