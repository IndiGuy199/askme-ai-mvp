// debug-stripe.js - Script to help diagnose Stripe integration issues
const { createClient } = require('@supabase/supabase-js')

// This script helps debug the Stripe integration
console.log('🔍 Stripe Integration Debug Checklist')
console.log('=====================================')

console.log('\n1. Environment Variables Check:')
console.log('   STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? '✅ Set' : '❌ Missing')
console.log('   STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET ? '✅ Set' : '❌ Missing')
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('   SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? '✅ Set' : '❌ Missing')

console.log('\n2. Price IDs in Code:')
console.log('   10k tokens ($4.99): price_1RWlea4gLT9aIqMDkebCi9N2')
console.log('   25k tokens ($9.99): price_1RWlfr4gLT9aIqMDl62HX9DF')

console.log('\n3. Webhook Endpoints Available:')
console.log('   Next.js API Route: /api/webhook')
console.log('   Vercel Function: /functions/stripeWebhook')

console.log('\n4. Troubleshooting Steps:')
console.log('   □ Verify Stripe webhook URL in Stripe dashboard')
console.log('   □ Check webhook secret matches environment variable')
console.log('   □ Confirm price IDs match Stripe products')
console.log('   □ Test webhook endpoint manually')
console.log('   □ Check user lookup logic in database')

async function testUserLookup() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    console.log('\n❌ Cannot test user lookup - missing Supabase credentials')
    return
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE)
  
  console.log('\n5. Testing User Lookup:')
  try {
    // Test with a generic query to see if users table is accessible
    const { data, error } = await supabase.from('users').select('id, email, tokens').limit(1)
    
    if (error) {
      console.log('   ❌ Error accessing users table:', error.message)
    } else {
      console.log('   ✅ Users table accessible')
      console.log('   Sample user structure:', data[0] ? Object.keys(data[0]) : 'No users found')
    }
  } catch (err) {
    console.log('   ❌ Database connection error:', err.message)
  }
}

testUserLookup()

console.log('\n6. Recommended Actions:')
console.log('   1. Remove duplicate webhook handler (keep only /api/webhook)')
console.log('   2. Update Stripe webhook URL to: https://yourdomain.com/api/webhook')
console.log('   3. Verify webhook events are being received')
console.log('   4. Add test purchase with detailed logging')
console.log('   5. Check Stripe dashboard for webhook delivery attempts')
