/**
 * POST /api/support-now/protocol
 * 
 * DEPRECATED: This endpoint now proxies to /api/coach/protocol
 * All urge protocols are generated through Coach AI system for consistency
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Forward request to Coach AI endpoint
    const coachApiUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}/api/coach/protocol`
      : 'http://localhost:3000/api/coach/protocol';

    const response = await fetch(coachApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('Error proxying to Coach AI protocol:', error);
    return res.status(500).json({ 
      error: 'Failed to generate protocol',
      details: error.message 
    });
  }
}
