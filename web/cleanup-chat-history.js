/**
 * Manual chat cleanup script
 * Run this script to clean up old chat messages for users with memory summaries
 */

const { cleanupUserChatHistory, bulkCleanupChatHistory, getCleanupStats } = require('./lib/chatCleanup');

async function main() {
  console.log('🧹 Starting Chat History Cleanup');
  console.log('==================================');
  
  try {
    // Get current stats
    console.log('\n📊 Current Database Stats:');
    const stats = await getCleanupStats();
    console.log(`Total messages: ${stats.totalMessages}`);
    console.log(`Users with memory: ${stats.usersWithMemory}`);
    console.log(`Users without memory: ${stats.usersWithoutMemory}`);
    console.log(`Recent messages (1 week): ${stats.recentMessages}`);
    console.log(`Old messages (1+ month): ${stats.oldMessages}`);
    console.log(`Cleanup opportunity: ${stats.cleanupOpportunity} messages`);

    if (stats.cleanupOpportunity === 0) {
      console.log('\n✅ No cleanup needed - all messages are recent');
      return;
    }

    // Proceed with cleanup
    console.log('\n🔄 Running bulk cleanup...');
    const results = await bulkCleanupChatHistory(15, 100); // Keep 15 messages, process 100 users
    
    console.log('\n📋 Cleanup Results:');
    console.log(`Users processed: ${results.totalUsersProcessed}`);
    console.log(`Successful cleanups: ${results.successfulCleanups}`);
    console.log(`Skipped cleanups: ${results.skippedCleanups}`);
    console.log(`Messages deleted: ${results.totalMessagesDeleted}`);
    console.log(`Messages kept: ${results.totalMessagesKept}`);
    
    if (results.errors.length > 0) {
      console.log(`\n❌ Errors encountered: ${results.errors.length}`);
      results.errors.forEach(error => {
        console.log(`  - User ${error.user_id}: ${error.error}`);
      });
    }

    // Get updated stats
    console.log('\n📊 Updated Database Stats:');
    const newStats = await getCleanupStats();
    console.log(`Total messages: ${newStats.totalMessages} (was ${stats.totalMessages})`);
    console.log(`Reduction: ${stats.totalMessages - newStats.totalMessages} messages`);
    
    const reductionPercent = ((stats.totalMessages - newStats.totalMessages) / stats.totalMessages * 100).toFixed(1);
    console.log(`Space saved: ${reductionPercent}%`);

    console.log('\n✅ Cleanup completed successfully!');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Chat History Cleanup Tool

Usage: node cleanup-chat-history.js [options]

Options:
  --help, -h     Show this help message
  --stats-only   Show database stats without performing cleanup
  --user <id>    Clean up specific user only

Examples:
  node cleanup-chat-history.js                    # Run bulk cleanup
  node cleanup-chat-history.js --stats-only       # Show stats only
  node cleanup-chat-history.js --user 123-456...  # Clean specific user
`);
  process.exit(0);
}

if (args.includes('--stats-only')) {
  // Stats only mode
  (async () => {
    try {
      const stats = await getCleanupStats();
      console.log('📊 Database Statistics:');
      console.log(JSON.stringify(stats, null, 2));
    } catch (error) {
      console.error('Error getting stats:', error);
      process.exit(1);
    }
  })();
} else if (args.includes('--user')) {
  // Single user cleanup mode
  const userIndex = args.indexOf('--user');
  const userId = args[userIndex + 1];
  
  if (!userId) {
    console.error('❌ User ID required when using --user flag');
    process.exit(1);
  }
  
  (async () => {
    try {
      console.log(`🧹 Cleaning up user: ${userId}`);
      const result = await cleanupUserChatHistory(userId, 15, true);
      console.log('Result:', result);
    } catch (error) {
      console.error('Error cleaning user:', error);
      process.exit(1);
    }
  })();
} else {
  // Run main bulk cleanup
  main();
}
