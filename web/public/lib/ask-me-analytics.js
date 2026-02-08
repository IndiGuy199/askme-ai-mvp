(function(window) {
  'use strict';

  const VERSION = '1.0.1';

  // Check if PostHog $autocapture event belongs to our custom-tracked elements
  function elementsMatchCustomTokens(elements = []) {
    if (!elements?.length) return false;
    const ids = new Set(elements.map(e => e?.attr_id).filter(Boolean));
    const classes = new Set(
      elements.flatMap(e => (e?.attr_class || [])).filter(Boolean)
    );
    // id or class match suppresses autocapture
    for (const id of ids) if (CustomTokens.id.has(id)) return true;
    for (const cls of classes) if (CustomTokens.class.has(cls)) return true;
    return false;
  }

  // NEW: single place to decide if we should drop $autocapture
  function shouldSuppressAutocapture(props = {}) {
    try {
      const now = Date.now();
      if (now - (window.__ga_lastCustomEventAt || 0) < 600) return true;
      if (now - (window.__ga_lastCustomIntentAt || 0) < 600) return true;

      const elements = props.$elements || [];
      if (elementsMatchCustomTokens(elements)) return true;

      // Also suppress if PH already sees our no-capture class on the path
      for (const el of elements) {
        const classes = el?.attr_class || [];
        if (classes.includes('ph-no-capture')) return true;
      }
    } catch {}
    return false;
  }

  // Direct PostHog initialization using the official snippet
  function initializePostHog(apiKey, apiHost, options = {}) {
    console.log('🔧 Initializing PostHog (autocapture only)...');

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    posthog.init(apiKey, {
      api_host: apiHost,
      debug: options.debug ?? true,
      autocapture: true,                 // always on
      capture_pageview: options.capture_pageview ?? true,
      capture_pageleave: options.capture_pageleave ?? true,
      session_recording: {
        recordCrossOriginIframes: true,
        maskAllInputs: false,
        captureKeystrokes: false,
        ...(options.session_recording || {})
      },
      // No before_send suppression; let $autocapture flow
      loaded: function() {
        console.log('✅ PostHog loaded (autocapture enabled)');
      }
    });
    return true;
  }

  // Keep a single place for custom selector tokens (used for suppression)
  const CustomTokens = {
    class: new Set(),
    id: new Set()
  };

  function collectTokensFromSelector(selector) {
    try {
      const parts = String(selector).split(',').map((s) => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        [...p.matchAll(/#([a-zA-Z0-9_-]+)/g)].forEach((m) =>
          GenericAnalytics.customSelectorTokens.push({ type: 'id', value: m[1] })
        );
        [...p.matchAll(/\.([a-zA-Z0-9_-]+)/g)].forEach((m) =>
          GenericAnalytics.customSelectorTokens.push({ type: 'class', value: m[1] })
        );
      });
    } catch {}
  }

  function tagNoCaptureNow(selector) {
    try {
      document.querySelectorAll(selector).forEach((el) => {
        el.classList?.add?.('ph-no-capture');
        el.setAttribute?.('data-ph-no-capture', 'true');
      });
    } catch {}
  }

  function observeAndTag(selector) {
    try {
      const mo = new MutationObserver(() => tagNoCaptureNow(selector));
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch {}
  }

  function addIntentCapture(selector) {
    try {
      document.addEventListener(
        'pointerdown',
        (e) => {
          let el = e.target;
          if (!el) return;
          if (el.matches?.(selector) || el.closest?.(selector)) {
            const target = el.matches?.(selector) ? el : el.closest(selector);
            target.classList?.add?.('ph-no-capture');
            target.setAttribute?.('data-ph-no-capture', 'true');
            window.__ga_lastCustomIntentAt = Date.now();
          }
        },
        true // capture phase so PH sees it before click
      );
    } catch {}
  }

  // Legacy helper kept for compatibility; now same behavior (no suppression)
  function initPosthog(apiKey, apiHost, debug) {
    posthog.init(apiKey, {
      api_host: apiHost,
      debug: !!debug,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      loaded: () => console.log('✅ PostHog loaded (autocapture enabled)')
    });
  }

  const GenericAnalytics = {
    version: VERSION,
    clientId: null,
    workflows: [],
    initialized: false,
    debug: false,
    preferCustomOverAutocapture: true,
    customSelectorTokens: [],

    init(config) {
      if (!config || !config.apiKey) {
        console.error('GenericAnalytics: Missing required apiKey in config');
        return;
      }

      this.clientId = config.clientId || 'askme-ai-app';
      this.workflows = Array.isArray(config.workflows) ? config.workflows : [];
      this.debug = !!config.debug;

      // Autocapture-first mode
      this.autocapture = true;
      this.useBuiltInPageview = config.useBuiltInPageview !== false;
      this.enableCustomDomTracking = false;    // turn off all custom DOM listeners
      this.preferCustomOverAutocapture = false;

      console.log('🔧 GenericAnalytics initializing (autocapture only)', {
        clientId: this.clientId,
        debug: this.debug
      });

      try {
        initializePostHog(config.apiKey, config.apiHost, {
          debug: this.debug,
          autocapture: true,
          capture_pageview: config.capture_pageview ?? true,
          capture_pageleave: config.capture_pageleave ?? true,
          session_recording: config.session_recording
        });
        this.initialized = true;

        setTimeout(() => {
          // Only pageview and manual events for now
          if (this.useBuiltInPageview) this.trackPageView();

          if (window.posthog) {
            try { window.posthog.register({ client_id: this.clientId }); } catch {}
          }

          this.trackEvent('analytics_initialized', {
            version: VERSION,
            client_id: this.clientId,
            mode: 'autocapture_only'
          });
        }, 300);
      } catch (initError) {
        console.error('❌ PostHog initialization error:', initError);
      }
    },

    // No-op: we’re not registering workflow selectors right now
    registerCustomSelector(selector) {
      return;
    },

    // Only keep global pageview/identify/trackEvent utilities
    setupTracking() {
      // Intentionally empty in autocapture-only mode
    },

    trackPageView(url = null, properties = {}) {
      const pageUrl = url || window.location.href;
      const pathname =
        (typeof URL !== 'undefined')
          ? new URL(pageUrl, window.location.origin).pathname
          : window.location.pathname;

      // Standard PostHog pageview (shows in Web Analytics)
      if (window.posthog) {
        window.posthog.capture('$pageview', {
          $current_url: pageUrl,
          $pathname: pathname,
          page_title: document.title,
          ...properties
        });
      }

      // Optional custom event for your own funnels/dashboards
      return this.trackEvent('page_view', {
        page_url: pageUrl,
        page_title: document.title,
        page_type: this.getPageType(),
        ...properties
      });
    },

    trackEvent(eventName, extraProps = {}) {
      if (!window.posthog) {
        console.warn('PostHog not available, cannot track event:', eventName);
        return false;
      }
      // remember last custom event moment (used by before_send)
      window.__ga_lastCustomEventAt = Date.now();

      const eventData = {
        client_id: this.clientId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        user_agent: navigator.userAgent,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`,
        page_title: document.title,
        referrer: document.referrer,
        ...extraProps
      };
      try {
        window.posthog.capture(eventName, eventData);
        if (this.debug) console.log('📊 Event tracked:', eventName, eventData);
        return true;
      } catch (error) {
        console.error('❌ Error tracking event:', error);
        return false;
      }
    },

    identify(userId, properties = {}) {
      if (!window.posthog) {
        console.warn('PostHog not available, cannot identify user');
        return false;
      }

      try {
        window.posthog.identify(userId, {
          client_id: this.clientId,
          ...properties
        });
        console.log('👤 User identified:', userId);
        return true;
      } catch (error) {
        console.error('❌ Error identifying user:', error);
        return false;
      }
    },

    getPageType() {
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
    },

    // Manual test method
    sendTestEvent() {
      console.log('🧪 Sending manual test event...');
      const success = this.trackEvent('manual_test_event', {
        test_type: 'manual_trigger',
        test_time: new Date().toISOString(),
        posthog_available: !!window.posthog
      });
      
      if (success) {
        console.log('✅ Manual test event sent successfully');
      } else {
        console.log('❌ Failed to send manual test event');
      }
      
      return success;
    },

    // Debug method to check status
    getStatus() {
      return {
        version: VERSION,
        initialized: this.initialized,
        posthog_available: !!window.posthog,
        client_id: this.clientId,
        workflows_count: this.workflows.length
      };
    }
  };

  // Expose the library to global scope
  window.GenericAnalytics = GenericAnalytics;
  window.askMeAnalytics = GenericAnalytics;

  console.info(`✅ GenericAnalytics v${VERSION} loaded`);

})(window);
