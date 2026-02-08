import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.genericAnalyticsLoaded) {
      const script = document.createElement('script');
      script.src = '/lib/ask-me-analytics.js';
      script.async = true;

      script.onload = () => {
        try {
          console.log('✅ Analytics script loaded');
          if (window.GenericAnalytics) {
            const getPageType = () => {
              const path = window.location.pathname.toLowerCase();
              if (path === '/' || path === '') return 'home';
              if (path.includes('/login') || path.includes('/signin')) return 'auth';
              if (path.includes('/signup') || path.includes('/register')) return 'registration';
              if (path.includes('/dashboard')) return 'dashboard';
              if (path.includes('/profile') || path.includes('/settings')) return 'profile';
              if (path.includes('/chat') || path.includes('/conversation')) return 'chat';
              if (path.includes('/pricing') || path.includes('/plans')) return 'pricing';
              if (path.includes('/about')) return 'about';
              if (path.includes('/contact')) return 'contact';
              if (path.includes('/help') || path.includes('/support')) return 'support';
              return 'other';
            };

            window.GenericAnalytics.init({
              apiKey: 'phc_MN5MXCec7lNZtZakqpRQZqTLaPfcV6CxeE8hfbTUFE2',
              apiHost: 'https://us.i.posthog.com',
              clientId: 'askme-ai-app',
              debug: true,
              autocapture: true,                 // keep PostHog autocapture ON
              useBuiltInPageview: true,
              capture_pageview: true,
              capture_pageleave: true,
              enableCustomDomTracking: true,    // REQUIRED so workflow listeners fire
              preferCustomOverAutocapture: true,   // custom wins over $autocapture

              getPageType,
              workflows: [
                // Authentication & User Management
                {
                  name: 'authentication',
                  selector: '.login-btn, .signin-btn, #login-button, form[action*="login"] button[type="submit"], #login-form button[type="submit"]',
                  startEvent: 'login_started',
                  stepsSelectors: [
                    // email inputs
                    { selector: 'input[type="email"], input[name="email"], #email, #login_email, form[action*="login"] input[type="email"]', event: 'email_entered', eventType: 'blur' },
                    // password inputs
                    { selector: 'input[type="password"], input[name="password"], #password, #login_password, form[action*="login"] input[type="password"]', event: 'password_entered', eventType: 'blur' },
                    // submit buttons
                    { selector: '.login-submit, .signin-submit, button[type="submit"].btn-submit, #login-form button[type="submit"], form[action*="login"] button[type="submit"]', event: 'login_attempted' },
                    { selector: '.forgot-password, .reset-password, a[href*="forgot"], a[href*="reset"]', event: 'password_reset_requested' },
                    { selector: '.signup-link, .register-link, a[href*="signup"], a[href*="register"]', event: 'signup_link_clicked' },
                    { selector: '.logout-btn, .signout-btn, a[href*="logout"], button.logout', event: 'logout_clicked' },
                    { selector: '.logout-confirm, button.confirm-logout', event: 'logout_confirmed' }
                  ]
                },

                // User Registration
                {
                  name: 'user_registration',
                  selector: '.signup-btn, .register-btn, #signup-button, #signup-form button[type="submit"], form[action*="signup"] button[type="submit"]',
                  startEvent: 'signup_started',
                  stepsSelectors: [
                    { selector: 'input[name="firstName"], input[name="first_name"], #firstName, #first_name', event: 'first_name_entered', eventType: 'blur' },
                    { selector: 'input[name="lastName"], input[name="last_name"], #lastName, #last_name', event: 'last_name_entered', eventType: 'blur' },
                    { selector: 'input[name="email"], #email, #signup_email, form[action*="signup"] input[type="email"]', event: 'signup_email_entered', eventType: 'blur' },
                    { selector: 'input[name="password"], #password, #signup_password, form[action*="signup"] input[type="password"]', event: 'signup_password_entered', eventType: 'blur' },
                    { selector: '.terms-checkbox, input[name="terms"], #terms, input[id*="terms"]', event: 'terms_accepted', eventType: 'change' },
                    { selector: '.privacy-checkbox, input[name="privacy"], #privacy, input[id*="privacy"]', event: 'privacy_accepted', eventType: 'change' },
                    { selector: '.signup-submit, .register-submit, button[type="submit"].btn-submit, #signup-form button[type="submit"]', event: 'signup_attempted' },
                    { selector: '.verification-code, input[name*="code"], input[id*="code"]', event: 'email_verification_started', eventType: 'focus' }
                  ]
                },

                // User Onboarding
                {
                  name: 'user_onboarding',
                  selector: '.start-onboarding, #start-onboarding-btn, button.start-onboarding',
                  startEvent: 'onboarding_started',
                  stepsSelectors: [
                    { selector: '.profile-setup-start, #profile-setup-start, [data-step="profile-start"]', event: 'profile_setup_started' },
                    { selector: '.category-selection, .categorySelect, [data-role="category-selection"]', event: 'primary_category_selected' },
                    { selector: '.coach-profile-selection, [data-role="coach-profile"]', event: 'coach_profile_selected' },
                    { selector: '.consent-accepted, input[name="consent"], #consent', event: 'consent_accepted' },
                    { selector: '.profile-setup-complete, [data-finish="profile"]', event: 'profile_setup_completed' }
                  ]
                },

                // Chat Interactions
                {
                  name: 'chat_interaction',
                  selector: '.sendButton, .send-button, #sendButton, form.chat-form button[type="submit"]',
                  startEvent: 'chat_started',
                  stepsSelectors: [
                    { selector: '.chat-input, textarea.chat-input, #chat-input, form.chat-form textarea', event: 'message_typed', eventType: 'focus' },
                    { selector: '.sendButton, .send-button, #sendButton, form.chat-form button[type="submit"]', event: 'message_sent' }
                  ]
                },

                // Goal Management
                {
                  name: 'goal_management',
                  selector: '.goal-selection, .add-goal-btn, [data-role="goal-select"]',
                  startEvent: 'goal_interaction_started',
                  stepsSelectors: [
                    { selector: '.goal-selection, select.goal-selection, [name="goal"], [data-role="goal-select"]', event: 'goal_selected', eventType: 'change' },
                    { selector: '.add-custom-goal, .add-goal-btn, button.add-goal', event: 'custom_goal_created' },
                    { selector: '.goal-progress-update, [data-role="goal-progress"]', event: 'goal_progress_updated' },
                    { selector: '.suggest-action-btn, button.suggest-action', event: 'action_suggestion_requested' },
                    { selector: '.accept-suggested-action, button.accept-suggested-action', event: 'suggested_action_accepted' }
                  ]
                },

                // Dashboard Navigation
                {
                  name: 'dashboard_navigation',
                  selector: '.nav-item, .dashboard-section, a.nav-link, [data-section]',
                  startEvent: 'dashboard_navigation_started',
                  stepsSelectors: [
                    { selector: '.goals-section, [data-section="goals"], #goals', event: 'goals_section_viewed' },
                    { selector: '.challenges-section, [data-section="challenges"], #challenges', event: 'challenges_section_viewed' },
                    { selector: '.actions-section, [data-section="actions"], #actions', event: 'actions_section_viewed' },
                    { selector: '.progress-section, [data-section="progress"], #progress', event: 'progress_section_viewed' }
                  ]
                },

                // FAQ & Help Section
                {
                  name: 'help_and_support',
                  selector: '.faq-btn, .help-btn, .support-btn, #faq-link, a[href*="faq"], a[href*="help"]',
                  startEvent: 'help_section_accessed',
                  stepsSelectors: [
                    { selector: '.faq-category, .faq-section, [data-faq="category"]', event: 'faq_category_selected' },
                    { selector: '.faq-question, .faq-item, .accordion-button, .accordion-header button, [data-bs-toggle="collapse"]', event: 'faq_question_clicked' },
                    { selector: '.faq-expand, .faq-toggle, .accordion-button[aria-expanded]', event: 'faq_answer_expanded' },
                    { selector: '.faq-helpful-yes, [data-faq-vote="yes"]', event: 'faq_marked_helpful' },
                    { selector: '.faq-helpful-no, [data-faq-vote="no"]', event: 'faq_marked_not_helpful' },
                    { selector: '.search-faq, .faq-search, input[type="search"][name*="faq"]', event: 'faq_searched', eventType: 'input' },
                    { selector: '.contact-from-faq, a[href*="contact"]', event: 'contact_initiated_from_faq' },
                    { selector: '.chat-support-btn, [data-role="live-chat"]', event: 'live_chat_requested' }
                  ]
                },

                // Contact Us
                {
                  name: 'contact_us',
                  selector: '.contact-btn, .contact-us-btn, #contact-link, a[href*="contact"]',
                  startEvent: 'contact_form_accessed',
                  stepsSelectors: [
                    { selector: 'input[name="contactName"], input[name="name"], #name, #contactName', event: 'contact_name_entered', eventType: 'blur' },
                    { selector: 'input[name="contactEmail"], input[name="contact_email"], input[type="email"], #email, #contactEmail', event: 'contact_email_entered', eventType: 'blur' },
                    { selector: 'select[name="subject"], .contact-subject, #subject', event: 'contact_subject_selected', eventType: 'change' },
                    { selector: 'textarea[name="message"], .contact-message, #message, #contactMessage', event: 'contact_message_entered', eventType: 'blur' },
                    { selector: '.contact-submit, .send-message-btn, button[type="submit"].btn-submit, #contactForm button[type="submit"], form[action*="contact"] button[type="submit"]', event: 'contact_form_submitted' },
                    { selector: '.contact-phone, .phone-contact, a[href^="tel:"]', event: 'phone_contact_clicked' },
                    { selector: '.contact-email, .email-contact, a[href^="mailto:"]', event: 'email_contact_clicked' },
                    { selector: '.social-contact, .social-media-link, a[href*="twitter"], a[href*="facebook"], a[href*="instagram"], a[href*="linkedin"]', event: 'social_media_contact_clicked' }
                  ]
                },

                // Footer & Navigation Links
                {
                  name: 'site_navigation',
                  selector: '.footer-link, .nav-link, .menu-link, a.nav-link, a.menu-link, a.footer-link, .navbar-brand, .logo-link, header .logo a',
                  startEvent: 'site_navigation_clicked',
                  stepsSelectors: [
                    { selector: '.privacy-policy-link, a[href*="privacy"]', event: 'privacy_policy_viewed' },
                    { selector: '.terms-of-service-link, a[href*="terms"]', event: 'terms_of_service_viewed' },
                    { selector: '.about-us-link, a[href*="about"]', event: 'about_page_viewed' },
                    { selector: '.pricing-link, a[href*="pricing"], a[href*="plans"]', event: 'pricing_page_viewed' },
                    { selector: '.blog-link, a[href*="blog"]', event: 'blog_accessed' },
                    { selector: '.home-link, .logo-link, a[href="/"], a[href="#"]', event: 'home_page_clicked' }
                  ]
                },

                // Account Management
                {
                  name: 'account_management',
                  selector: '.account-settings, .profile-settings, .user-menu, a[href*="settings"], a[href*="profile"]',
                  startEvent: 'account_settings_accessed',
                  stepsSelectors: [
                    { selector: '.edit-profile, a[href*="edit-profile"]', event: 'profile_edit_started' },
                    { selector: '.change-password, a[href*="password"]', event: 'password_change_started' },
                    { selector: '.notification-preferences, a[href*="notifications"]', event: 'notification_settings_opened' },
                    { selector: '.billing-settings, a[href*="billing"], a[href*="subscription"]', event: 'billing_settings_accessed' },
                    { selector: '.delete-account, button.delete-account', event: 'account_deletion_requested' },
                    { selector: '.export-data, a[href*="export"]', event: 'data_export_requested' },
                    { selector: '.privacy-settings, a[href*="privacy"]', event: 'privacy_settings_accessed' }
                  ]
                },

                // Error Pages & 404s
                {
                  name: 'error_handling',
                  selector: '.error-page, .not-found, .404-page',
                  startEvent: 'error_page_encountered',
                  stepsSelectors: [
                    { selector: '.go-home-btn, a[href="/"]', event: 'error_home_clicked' },
                    { selector: '.report-error, [data-role="report-error"]', event: 'error_reported' },
                    { selector: '.search-from-error, input[type="search"]', event: 'search_from_error_page' },
                    { selector: '.contact-from-error, a[href*="contact"]', event: 'contact_from_error_page' }
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
                window.GenericAnalytics?.sendTestEvent?.();
              } else {
                console.error('❌ PostHog is NOT available after initialization');
              }
            }, 2000);
          } else {
            console.error('❌ GenericAnalytics not found on window object');
          }
        } catch (err) {
          console.error('❌ Error initializing analytics:', err);
        } finally {
          window.genericAnalyticsLoaded = true;
        }
      };

      script.onerror = (error) => {
        console.error('❌ Failed to load analytics script:', error);
      };

      document.head.appendChild(script);
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