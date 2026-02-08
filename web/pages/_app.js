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

              // Autocapture-first mode
              autocapture: true,
              useBuiltInPageview: true,
              capture_pageview: true,
              capture_pageleave: true,
              enableCustomDomTracking: false,     // disable our custom DOM listeners for now
              preferCustomOverAutocapture: false, // do not suppress $autocapture

              getPageType,

              // No custom workflows for now (keep empty to rely entirely on autocapture)
              workflows: []
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