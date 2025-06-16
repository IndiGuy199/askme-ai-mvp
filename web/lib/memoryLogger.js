/**
 * Memory Logging Utility
 * 
 * This utility provides enhanced logging for memory-related operations.
 * It helps track and debug memory summarization issues.
 */

const fs = require('fs');
const path = require('path');

// Configure log file path
const LOG_DIR = path.join(process.cwd(), 'logs');
const MEMORY_LOG_FILE = path.join(LOG_DIR, 'memory-debug.log');

// Ensure log directory exists
try {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Failed to create log directory:', err);
}

/**
 * Log a memory-related event with timestamp and user information
 */
function logMemoryEvent(userId, email, eventType, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId,
    email,
    eventType,
    details
  };
  
  const logString = JSON.stringify(logEntry) + '\n';
  
  // Log to console with pretty formatting
  console.log(`[MEMORY-${eventType}] ${timestamp} - User: ${email || userId}`);
  if (details) {
    if (typeof details === 'string') {
      console.log(`  ${details}`);
    } else {
      console.log('  Details:', details);
    }
  }
  
  // Append to log file
  try {
    fs.appendFileSync(MEMORY_LOG_FILE, logString);
  } catch (err) {
    console.error('Failed to write to memory log file:', err);
  }
}

/**
 * Log the start of a memory summarization process
 */
function logSummarizationStart(userId, email, messageCount, sessionEnd = false) {
  logMemoryEvent(userId, email, 'SUMMARIZE_START', {
    messageCount,
    sessionEnd,
    trigger: sessionEnd ? 'session_end' : messageCount % 4 === 0 ? 'message_count' : 'manual'
  });
}

/**
 * Log the successful completion of a memory summarization
 */
function logSummarizationSuccess(userId, email, summaryLength) {
  logMemoryEvent(userId, email, 'SUMMARIZE_SUCCESS', {
    summaryLength,
    previewText: summaryLength > 0 ? '✅ Summary generated successfully' : '⚠️ Empty summary generated'
  });
}

/**
 * Log a failure in the memory summarization process
 */
function logSummarizationFailure(userId, email, error) {
  logMemoryEvent(userId, email, 'SUMMARIZE_FAILURE', {
    errorMessage: error.message,
    errorStack: error.stack
  });
}

/**
 * Log a profile check event
 */
function logProfileCheck(userId, email, hasProfile, memoryLength) {
  logMemoryEvent(userId, email, 'PROFILE_CHECK', {
    hasProfile,
    memoryLength,
    status: !hasProfile ? 'missing_profile' : memoryLength === 0 ? 'empty_memory' : 'has_memory'
  });
}

/**
 * Log a database constraint violation or other database error
 */
function logDatabaseError(userId, email, operation, error) {
  // Check for common error types
  const isConstraintViolation = error.code === '23505'; // PostgreSQL unique constraint violation
  const isPGError = error.code && error.code.startsWith('PG');
  
  logMemoryEvent(userId, email, 'DATABASE_ERROR', {
    operation,
    errorCode: error.code || 'UNKNOWN',
    errorMessage: error.message,
    errorType: isConstraintViolation ? 'CONSTRAINT_VIOLATION' : 
               isPGError ? 'POSTGRES_ERROR' : 'OTHER_ERROR',
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  logMemoryEvent,
  logSummarizationStart,
  logSummarizationSuccess,
  logSummarizationFailure,
  logProfileCheck,
  logDatabaseError
};
