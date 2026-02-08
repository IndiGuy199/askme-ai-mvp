export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const { clientId, dateRange = 7, comparisonMode = 'none' } = req.body;

    if (!clientId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Client ID is required' 
      });
    }

    // PostHog API configuration
    const POSTHOG_PROJECT_API_KEY = process.env.POSTHOG_PROJECT_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

    if (!POSTHOG_PROJECT_API_KEY) {
      console.warn('⚠️ PostHog API key not configured - returning mock data');
      return res.status(200).json({
        success: true,
        data: {
          totalEvents: 0,
          uniqueUsers: 0,
          growth: 0,
          source: 'mock_no_key'
        },
        message: 'PostHog not configured - showing placeholder data'
      });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dateRange);

    console.log(`📊 Fetching analytics for ${clientId} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // PostHog query configuration
    const queryParams = {
      date_from: startDate.toISOString().split('T')[0],
      date_to: endDate.toISOString().split('T')[0],
      events: [
        { id: '$pageview', name: '$pageview' },
        { id: 'page_view', name: 'page_view' },
        { id: 'chat_message_sent', name: 'chat_message_sent' },
        { id: 'goal_completed', name: 'goal_completed' }
      ],
      properties: [
        {
          key: 'client_id',
          value: clientId,
          operator: 'exact',
          type: 'event'
        }
      ]
    };

    // Set timeout for PostHog requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${POSTHOG_HOST}/api/projects/${getProjectId()}/insights/trend/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${POSTHOG_PROJECT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(queryParams),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`PostHog API error: ${response.status} ${response.statusText}`);
      }

      const posthogData = await response.json();
      
      // Process PostHog response
      const analyticsData = processPostHogData(posthogData, dateRange);

      return res.status(200).json({
        success: true,
        data: analyticsData,
        message: 'Analytics data retrieved successfully'
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.warn('⚠️ PostHog request timed out - returning fallback data');
        return res.status(200).json({
          success: true,
          data: {
            totalEvents: 0,
            uniqueUsers: 0,
            growth: 0,
            source: 'timeout_fallback'
          },
          message: 'PostHog timed out - showing placeholder data'
        });
      }

      console.error('PostHog API error:', fetchError.message);
      
      // Return success with empty data instead of failing
      return res.status(200).json({
        success: true,
        data: {
          totalEvents: 0,
          uniqueUsers: 0,
          growth: 0,
          source: 'error_fallback',
          error: fetchError.message
        },
        message: 'PostHog unavailable - showing placeholder data'
      });
    }

  } catch (error) {
    console.error('Analytics API error:', error);
    
    // Even on server errors, return a success response with empty data
    // This prevents frontend components from getting stuck in error states
    return res.status(200).json({
      success: true,
      data: {
        totalEvents: 0,
        uniqueUsers: 0,
        growth: 0,
        source: 'server_error_fallback'
      },
      message: 'Server error - showing placeholder data'
    });
  }
}

function getProjectId() {
  // Extract project ID from PostHog key or use environment variable
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
  if (key.startsWith('phc_')) {
    // For project API keys, you might need to configure the project ID separately
    return process.env.POSTHOG_PROJECT_ID || '1'; // Default project ID
  }
  return '1';
}

function processPostHogData(posthogData, dateRange) {
  try {
    // Process the PostHog response format
    const results = posthogData?.result || [];
    
    let totalEvents = 0;
    let uniqueUsers = 0;
    let previousPeriodEvents = 0;
    
    // Sum up events from all result series
    results.forEach(series => {
      if (series.data) {
        totalEvents += series.data.reduce((sum, value) => sum + (value || 0), 0);
      }
      if (series.persons_urls) {
        uniqueUsers += series.persons_urls.length;
      }
    });

    // Calculate growth (simplified)
    const growth = previousPeriodEvents > 0 
      ? Math.round(((totalEvents - previousPeriodEvents) / previousPeriodEvents) * 100)
      : totalEvents > 0 ? 100 : 0;

    return {
      totalEvents,
      uniqueUsers,
      growth,
      dateRange,
      source: 'posthog',
      rawData: process.env.NODE_ENV === 'development' ? posthogData : undefined
    };
  } catch (processingError) {
    console.error('Error processing PostHog data:', processingError);
    return {
      totalEvents: 0,
      uniqueUsers: 0,
      growth: 0,
      source: 'processing_error',
      error: processingError.message
    };
  }
}
