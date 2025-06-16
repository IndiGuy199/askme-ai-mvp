#!/bin/bash

# Automated chat cleanup cron job
# Add this to your crontab to run daily cleanup
# Example: 0 2 * * * /path/to/your/project/scripts/daily-cleanup.sh

# Configuration
API_URL="http://localhost:3000/api/cleanup"  # Change to your production URL
CLEANUP_API_KEY="${CLEANUP_API_KEY}"  # Set this environment variable
LOG_FILE="/var/log/chat-cleanup.log"

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log "Starting daily chat cleanup"

# Get current stats
stats_response=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $CLEANUP_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"action":"stats"}')

if [ $? -eq 0 ]; then
    log "Current stats: $stats_response"
else
    log "ERROR: Failed to get current stats"
    exit 1
fi

# Run bulk cleanup
cleanup_response=$(curl -s -X POST "$API_URL" \
    -H "Authorization: Bearer $CLEANUP_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"action":"bulk_cleanup","keep_messages":15,"max_users":100}')

if [ $? -eq 0 ]; then
    log "Cleanup completed: $cleanup_response"
else
    log "ERROR: Cleanup failed"
    exit 1
fi

log "Daily cleanup completed successfully"
