import { supabase } from '../../utils/supabaseClient'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Get user's consent history
    const { email } = req.query
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    try {
      const { data: consentHistory, error } = await supabase
        .from('user_consent')
        .select('*')
        .eq('email', email)
        .order('consent_date', { ascending: false })

      if (error) throw error

      return res.status(200).json({ 
        success: true, 
        consentHistory,
        hasActiveConsent: consentHistory.some(c => c.is_active && c.consent_accepted)
      })
    } catch (error) {
      console.error('Error fetching consent history:', error)
      return res.status(500).json({ error: 'Failed to fetch consent history' })
    }
  }

  if (req.method === 'DELETE') {
    // Withdraw consent
    const { email, reason } = req.body
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' })
    }

    try {
      // Mark all active consent records as withdrawn
      const { error } = await supabase
        .from('user_consent')
        .update({
          is_active: false,
          withdrawal_date: new Date().toISOString(),
          withdrawal_reason: reason || 'User requested withdrawal',
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .eq('is_active', true)

      if (error) throw error

      return res.status(200).json({ 
        success: true, 
        message: 'Consent withdrawn successfully' 
      })
    } catch (error) {
      console.error('Error withdrawing consent:', error)
      return res.status(500).json({ error: 'Failed to withdraw consent' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}