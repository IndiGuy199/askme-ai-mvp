import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function MyApp({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.genericAnalyticsLoaded) {
      console.log('🔧 Loading analytics script...');
      
      const script = document.createElement('script')
      script.src = '/lib/ask-me-analytics.js'
      script.async = true
      
      script.onload = () => {
        console.log('✅ Analytics script loaded successfully');
        
        try {
          // Initialize analytics with configuration
          if (window.GenericAnalytics) {
            window.GenericAnalytics.init({
              apiKey: 'phc_MN5MXCec7lNZtZakqpRQZqTLaPfcV6CxeE8hfbTUFE2',
              apiHost: 'https://us.i.posthog.com',
              clientId: 'askme-ai-app',
              debug: true, // Enable debug to see what's happening
              workflows: [
                // Authentication & User Management
                {
                  name: 'authentication',
                  selector: '.login-btn, .signin-btn, #login-button',
                  startEvent: 'login_started',
                  stepsSelectors: [
                    { selector: 'input[type="email"], input[name="email"]', event: 'email_entered', eventType: 'blur' },
                    { selector: 'input[type="password"], input[name="password"]', event: 'password_entered', eventType: 'blur' },
                    { selector: '.login-submit, .signin-submit, button[type="submit"]', event: 'login_attempted' },
                    { selector: '.forgot-password, .reset-password', event: 'password_reset_requested' },
                    { selector: '.signup-link, .register-link', event: 'signup_link_clicked' },
                    { selector: '.logout-btn, .signout-btn', event: 'logout_clicked' },
                    { selector: '.logout-confirm', event: 'logout_confirmed' }
                  ]
                },

                // User Registration
                {
                  name: 'user_registration',
                  selector: '.signup-btn, .register-btn, #signup-button',
                  startEvent: 'signup_started',
                  stepsSelectors: [
                    { selector: 'input[name="firstName"], input[name="first_name"]', event: 'first_name_entered', eventType: 'blur' },
                    { selector: 'input[name="lastName"], input[name="last_name"]', event: 'last_name_entered', eventType: 'blur' },
                    { selector: 'input[name="email"]', event: 'signup_email_entered', eventType: 'blur' },
                    { selector: 'input[name="password"]', event: 'signup_password_entered', eventType: 'blur' },
                    { selector: '.terms-checkbox, input[name="terms"]', event: 'terms_accepted', eventType: 'change' },
                    { selector: '.privacy-checkbox, input[name="privacy"]', event: 'privacy_accepted', eventType: 'change' },
                    { selector: '.signup-submit, .register-submit', event: 'signup_attempted' },
                    { selector: '.verification-code', event: 'email_verification_started', eventType: 'focus' }
                  ]
                },

                // User Onboarding
                {
                  name: 'user_onboarding',
                  selector: '.start-onboarding, #start-onboarding-btn',
                  startEvent: 'onboarding_started',
                  stepsSelectors: [
                    { selector: '.profile-setup-start', event: 'profile_setup_started' },
                    { selector: '.category-selection', event: 'primary_category_selected' },
                    { selector: '.coach-profile-selection', event: 'coach_profile_selected' },
                    { selector: '.consent-accepted', event: 'consent_accepted' },
                    { selector: '.profile-setup-complete', event: 'profile_setup_completed' }
                  ]
                },

                // Chat Interactions
                {
                  name: 'chat_interaction',
                  selector: '.sendButton, .send-button',
                  startEvent: 'chat_started',
                  stepsSelectors: [
                    { selector: '.chat-input', event: 'message_typed', eventType: 'focus' },
                    { selector: '.sendButton', event: 'message_sent' }
                  ]
                },

                // Goal Management
                {
                  name: 'goal_management',
                  selector: '.goal-selection, .add-goal-btn',
                  startEvent: 'goal_interaction_started',
                  stepsSelectors: [
                    { selector: '.goal-selection', event: 'goal_selected' },
                    { selector: '.add-custom-goal', event: 'custom_goal_created' },
                    { selector: '.goal-progress-update', event: 'goal_progress_updated' },
                    { selector: '.suggest-action-btn', event: 'action_suggestion_requested' },
                    { selector: '.accept-suggested-action', event: 'suggested_action_accepted' }
                  ]
                },

                // Dashboard Navigation
                {
                  name: 'dashboard_navigation',
                  selector: '.nav-item, .dashboard-section',
                  startEvent: 'dashboard_navigation_started',
                  stepsSelectors: [
                    { selector: '.goals-section', event: 'goals_section_viewed' },
                    { selector: '.challenges-section', event: 'challenges_section_viewed' },
                    { selector: '.actions-section', event: 'actions_section_viewed' },
                    { selector: '.progress-section', event: 'progress_section_viewed' }
                  ]
                },

                // FAQ & Help Section
                {
                  name: 'help_and_support',
                  selector: '.faq-btn, .help-btn, .support-btn, #faq-link',
                  startEvent: 'help_section_accessed',
                  stepsSelectors: [
                    { selector: '.faq-category, .faq-section', event: 'faq_category_selected' },
                    { selector: '.faq-question, .faq-item', event: 'faq_question_clicked' },
                    { selector: '.faq-expand, .faq-toggle', event: 'faq_answer_expanded' },
                    { selector: '.faq-helpful-yes', event: 'faq_marked_helpful' },
                    { selector: '.faq-helpful-no', event: 'faq_marked_not_helpful' },
                    { selector: '.search-faq, .faq-search', event: 'faq_searched', eventType: 'input' },
                    { selector: '.contact-from-faq', event: 'contact_initiated_from_faq' },
                    { selector: '.chat-support-btn', event: 'live_chat_requested' }
                  ]
                },

                // Contact Us
                {
                  name: 'contact_us',
                  selector: '.contact-btn, .contact-us-btn, #contact-link',
                  startEvent: 'contact_form_accessed',
                  stepsSelectors: [
                    { selector: 'input[name="contactName"], input[name="name"]', event: 'contact_name_entered', eventType: 'blur' },
                    { selector: 'input[name="contactEmail"], input[name="contact_email"]', event: 'contact_email_entered', eventType: 'blur' },
                    { selector: 'select[name="subject"], .contact-subject', event: 'contact_subject_selected', eventType: 'change' },
                    { selector: 'textarea[name="message"], .contact-message', event: 'contact_message_entered', eventType: 'blur' },
                    { selector: '.contact-submit, .send-message-btn', event: 'contact_form_submitted' },
                    { selector: '.contact-phone, .phone-contact', event: 'phone_contact_clicked' },
                    { selector: '.contact-email, .email-contact', event: 'email_contact_clicked' },
                    { selector: '.social-contact, .social-media-link', event: 'social_media_contact_clicked' }
                  ]
                },

                // Footer & Navigation Links
                {
                  name: 'site_navigation',
                  selector: '.footer-link, .nav-link, .menu-link',
                  startEvent: 'site_navigation_clicked',
                  stepsSelectors: [
                    { selector: '.privacy-policy-link', event: 'privacy_policy_viewed' },
                    { selector: '.terms-of-service-link', event: 'terms_of_service_viewed' },
                    { selector: '.about-us-link', event: 'about_page_viewed' },
                    { selector: '.pricing-link', event: 'pricing_page_viewed' },
                    { selector: '.blog-link', event: 'blog_accessed' },
                    { selector: '.home-link, .logo-link', event: 'home_page_clicked' }
                  ]
                },

                // Account Management
                {
                  name: 'account_management',
                  selector: '.account-settings, .profile-settings, .user-menu',
                  startEvent: 'account_settings_accessed',
                  stepsSelectors: [
                    { selector: '.edit-profile', event: 'profile_edit_started' },
                    { selector: '.change-password', event: 'password_change_started' },
                    { selector: '.notification-preferences', event: 'notification_settings_opened' },
                    { selector: '.billing-settings', event: 'billing_settings_accessed' },
                    { selector: '.delete-account', event: 'account_deletion_requested' },
                    { selector: '.export-data', event: 'data_export_requested' },
                    { selector: '.privacy-settings', event: 'privacy_settings_accessed' }
                  ]
                },

                // Error Pages & 404s
                {
                  name: 'error_handling',
                  selector: '.error-page, .not-found, .404-page',
                  startEvent: 'error_page_encountered',
                  stepsSelectors: [
                    { selector: '.go-home-btn', event: 'error_home_clicked' },
                    { selector: '.report-error', event: 'error_reported' },
                    { selector: '.search-from-error', event: 'search_from_error_page' },
                    { selector: '.contact-from-error', event: 'contact_from_error_page' }
                  ]
                }
              ]
            });
            
            console.log('✅ Analytics initialization requested');
            
            // Test if PostHog is available
            setTimeout(() => {
              if (window.posthog) {
                console.log('✅ PostHog is available');
                // Optional: Send a test event
                window.GenericAnalytics.sendTestEvent();
              } else {
                console.error('❌ PostHog is NOT available after initialization');
              }
            }, 2000);
            
          } else {
            console.error('❌ GenericAnalytics not found on window object');
          }
        } catch (err) {
          console.error('❌ Error initializing analytics:', err);
        }
        
        window.genericAnalyticsLoaded = true;
      }
      
      script.onerror = (error) => {
        console.error('❌ Failed to load analytics script:', error);
      }
      
      document.head.appendChild(script)
    }
  }, [])

  // Track page changes with enhanced metadata
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (typeof window !== 'undefined' && window.GenericAnalytics) {
        window.GenericAnalytics.trackPageView(url, {
          previous_url: window.location.href,
          navigation_type: 'spa_navigation'
        })
      }
    }

    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}