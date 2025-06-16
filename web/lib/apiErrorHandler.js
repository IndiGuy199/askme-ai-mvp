/**
 * API Error Handler for GPT Router
 * 
 * This utility module provides a top-level error handler for the GPT Router API endpoint.
 * It wraps the handler function to provide consistent error handling and logging.
 */

import { logMemoryEvent } from './memoryLogger.js';

/**
 * Wraps an API handler function with error handling and logging
 * @param {Function} handler - The API handler function to wrap
 * @returns {Function} - The wrapped handler function
 */
function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      // Execute the handler with error handling
      return await handler(req, res);
    } catch (error) {
      console.error('Unhandled error in gptRouter:', error);
      
      // Try to log the error with additional context
      try {
        const userId = req.query.userId || req.body?.userId || 'unknown';
        const email = req.query.email || req.body?.email || 'unknown@email.com';
        
        logMemoryEvent(userId, email, 'API_ERROR', {
          path: req.url,
          method: req.method,
          error: error.message,
          stack: error.stack
        });
      } catch (logError) {
        console.error('Failed to log API error:', logError);
      }
      
      // Return a proper error response
      res.status(500).json({ 
        error: 'An unexpected error occurred',
        message: process.env.NODE_ENV === 'production' 
          ? 'Server error' 
          : error.message
      });
    }
  };
}

export { withErrorHandling };
