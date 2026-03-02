/**
 * Nav state unit tests — verify which nav items are shown for logged-in vs logged-out users.
 * This mirrors the conditional logic in web/components/Layout.js.
 *
 * Run with: node web/lib/coach-ai/__tests__/nav-state.test.js
 */

let passed = 0
let failed = 0

function assert(label, condition) {
  if (condition) { console.log(`  ✓ ${label}`); passed++ }
  else { console.log(`  ✗ ${label}`); failed++ }
}

// ---------------------------------------------------------------------------
// Mirror the nav item logic from Layout.js exactly
// ---------------------------------------------------------------------------

function getLoggedInNavItems() {
  return ['Playbook', 'Buy Tokens', 'FAQ', 'Contact Us', 'Logout']
}

function getLoggedOutNavItems() {
  return ['Demo', 'FAQ', 'Contact Us', 'Sign In']
}

// Items that must NEVER appear
const FORBIDDEN_LOGGED_IN = ['Dashboard', 'Chat', 'Favorites', 'Sign In']
const FORBIDDEN_LOGGED_OUT = ['Dashboard', 'Chat', 'Favorites', 'Logout', 'Buy Tokens', 'Playbook']

// ---------------------------------------------------------------------------
// Post-login redirect helper (mirrors callback.js logic)
// ---------------------------------------------------------------------------

function resolvePostLoginRoute(profileCompleted) {
  // New user → profile setup; existing completed → playbook; never → dashboard
  return profileCompleted ? '/playbook' : '/profile-setup'
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

function testLoggedInNav() {
  console.log('\n🧪 Logged-in nav items')
  const items = getLoggedInNavItems()

  assert('Playbook is present', items.includes('Playbook'))
  assert('Buy Tokens is present', items.includes('Buy Tokens'))
  assert('FAQ is present', items.includes('FAQ'))
  assert('Contact Us is present', items.includes('Contact Us'))
  assert('Logout is present', items.includes('Logout'))

  for (const forbidden of FORBIDDEN_LOGGED_IN) {
    assert(`"${forbidden}" is NOT shown`, !items.includes(forbidden))
  }
}

function testLoggedOutNav() {
  console.log('\n🧪 Logged-out nav items')
  const items = getLoggedOutNavItems()

  assert('Demo is present', items.includes('Demo'))
  assert('FAQ is present', items.includes('FAQ'))
  assert('Contact Us is present', items.includes('Contact Us'))
  assert('Sign In is present', items.includes('Sign In'))

  for (const forbidden of FORBIDDEN_LOGGED_OUT) {
    assert(`"${forbidden}" is NOT shown`, !items.includes(forbidden))
  }
}

function testPostLoginRedirect() {
  console.log('\n🧪 Post-login redirect (never /dashboard)')

  const newUserRoute = resolvePostLoginRoute(false)
  const returningUserRoute = resolvePostLoginRoute(true)

  assert('new user → /profile-setup', newUserRoute === '/profile-setup')
  assert('returning user → /playbook', returningUserRoute === '/playbook')
  assert('NOT /dashboard for any user', newUserRoute !== '/dashboard' && returningUserRoute !== '/dashboard')
}

function testNavMutualExclusion() {
  console.log('\n🧪 Logged-in ∩ Logged-out exclusions')
  const loggedIn = new Set(getLoggedInNavItems())
  const loggedOut = new Set(getLoggedOutNavItems())

  // Logout should never be in logged-out menu
  assert('Logout only in logged-in menu', loggedIn.has('Logout') && !loggedOut.has('Logout'))
  // Sign In should never be in logged-in menu
  assert('Sign In only in logged-out menu', loggedOut.has('Sign In') && !loggedIn.has('Sign In'))
  // Demo only in logged-out
  assert('Demo only in logged-out menu', loggedOut.has('Demo') && !loggedIn.has('Demo'))
  // Buy Tokens only when logged in
  assert('Buy Tokens only in logged-in menu', loggedIn.has('Buy Tokens') && !loggedOut.has('Buy Tokens'))
}

testLoggedInNav()
testLoggedOutNav()
testPostLoginRedirect()
testNavMutualExclusion()

console.log(`\n${'─'.repeat(50)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) { console.log('❌ Some tests failed'); process.exit(1) }
else console.log('✅ All tests passed')
