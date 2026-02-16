/**
 * Simple test endpoint to verify routing works
 */

export default async function handler(req, res) {
  console.log('🧪 Test endpoint hit!');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Body:', req.body);
    
    return res.status(200).json({
      message: 'Test endpoint works!',
      receivedBody: req.body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
