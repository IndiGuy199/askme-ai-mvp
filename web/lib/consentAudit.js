/**
 * Consent Audit and Compliance Utilities
 */

import { supabase } from '../utils/supabaseClient'

/**
 * Generate compliance report for consent records
 */
export async function generateConsentReport(dateRange = null) {
  try {
    let query = supabase
      .from('user_consent')
      .select(`
        *,
        users!fk_user_consent_email(first_name, created_at as user_created)
      `)
      .order('consent_date', { ascending: false })

    if (dateRange) {
      query = query
        .gte('consent_date', dateRange.start)
        .lte('consent_date', dateRange.end)
    }

    const { data: consentRecords, error } = await query

    if (error) throw error

    const report = {
      totalRecords: consentRecords.length,
      activeConsent: consentRecords.filter(r => r.is_active).length,
      withdrawnConsent: consentRecords.filter(r => !r.is_active).length,
      consentByVersion: {},
      consentByMethod: {},
      ipAddresses: new Set(),
      dateRange: dateRange || { 
        start: new Date(Math.min(...consentRecords.map(r => new Date(r.consent_date)))).toISOString(),
        end: new Date(Math.max(...consentRecords.map(r => new Date(r.consent_date)))).toISOString()
      }
    }

    consentRecords.forEach(record => {
      // Group by version
      report.consentByVersion[record.consent_version] = 
        (report.consentByVersion[record.consent_version] || 0) + 1

      // Group by method
      report.consentByMethod[record.consent_method] = 
        (report.consentByMethod[record.consent_method] || 0) + 1

      // Track unique IPs
      if (record.ip_address) {
        report.ipAddresses.add(record.ip_address)
      }
    })

    report.uniqueIpAddresses = report.ipAddresses.size
    delete report.ipAddresses // Don't include the actual IPs in the report

    return report
  } catch (error) {
    console.error('Error generating consent report:', error)
    throw error
  }
}

/**
 * Verify user has valid consent
 */
export async function verifyUserConsent(email) {
  try {
    const { data: consent, error } = await supabase
      .from('user_consent')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .eq('consent_accepted', true)
      .order('consent_date', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return {
      hasValidConsent: !!consent,
      consentDate: consent?.consent_date,
      consentVersion: consent?.consent_version,
      needsUpdate: consent ? 
        new Date(consent.consent_date) < new Date('2024-01-01') : // Check if consent is old
        false
    }
  } catch (error) {
    console.error('Error verifying user consent:', error)
    return { hasValidConsent: false, error: error.message }
  }
}

/**
 * Log consent-related events for audit trail
 */
export async function logConsentEvent(email, eventType, details = {}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      email,
      eventType,
      details: JSON.stringify(details),
      ip_address: details.ip_address || null,
      user_agent: details.user_agent || null
    }

    // You could store these in a separate audit log table
    console.log('CONSENT_AUDIT:', logEntry)
    
    return logEntry
  } catch (error) {
    console.error('Error logging consent event:', error)
  }
}