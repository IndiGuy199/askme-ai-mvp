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
    console.log('🔧 Initializing PostHog directly...');

    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

    // Initialize PostHog with sane defaults to capture everything
    posthog.init(apiKey, {
      api_host: apiHost,
      debug: options.debug ?? true,
      autocapture: options.autocapture ?? true,
      capture_pageview: options.capture_pageview ?? true,
      capture_pageleave: options.capture_pageleave ?? true,
      session_recording: {
        recordCrossOriginIframes: true,
        maskAllInputs: false,
        captureKeystrokes: false,
        ...(options.session_recording || {})
      },
      // Drop $autocapture if a custom handler just fired or matches a custom selector
      before_send: (event) => {
        try {
          if (event?.event === '$autocapture' && window.GenericAnalytics?.preferCustomOverAutocapture) {
            if (shouldSuppressAutocapture(event.properties || {})) return null;
          }
        } catch {}
        return event;
      },
      loaded: function() {
        console.log('✅ PostHog loaded successfully');

        // NEW: hard block at capture time to avoid console “send $autocapture” logs
        try {
          const originalCapture = posthog.capture.bind(posthog);
          posthog.capture = function(name, props, options) {
            if (name === '$autocapture' && window.GenericAnalytics?.preferCustomOverAutocapture) {
              if (shouldSuppressAutocapture(props || {})) {
                if (window.GenericAnalytics?.debug) console.log('🛑 Suppressed $autocapture (capture wrapper)', { props });
                return; // do not call originalCapture()
              }
            }
            return originalCapture(name, props, options);
          };
        } catch {}
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

  // PostHog init (ensure before_send is set)
  function initPosthog(apiKey, apiHost, debug) {
    // ...existing loader/bootstrap code...

    posthog.init(apiKey, {
      api_host: apiHost,
      debug: !!debug,
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,

      // Suppress $autocapture only for custom-tracked elements/intents
      before_send: (ev) => {
        try {
          if (ev?.event === '$autocapture' && window.GenericAnalytics?.preferCustomOverAutocapture) {
            const recentCustomIntent = Date.now() - (window.__ga_lastCustomIntentAt || 0) < 500;
            if (recentCustomIntent) return null;
            if (elementsMatchCustomTokens(ev?.properties?.$elements)) return null;
          }
        } catch {}
        return ev;
      },

      loaded: () => console.log('✅ PostHog loaded (hybrid mode)')
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
      this.workflows = config.workflows || [];
      this.debug = config.debug || false;
      this.preferCustomOverAutocapture = config.preferCustomOverAutocapture ?? true;

      // New enabling logic: keep our custom DOM tracking on if we prefer custom
      this.autocapture = config.autocapture !== false; // default true
      this.useBuiltInPageview = config.useBuiltInPageview !== false;
      this.enableCustomDomTracking =
        config.enableCustomDomTracking ?? (this.preferCustomOverAutocapture || !this.autocapture);

      console.log('🔧 GenericAnalytics initializing with:', {
        apiKey: config.apiKey.substring(0, 10) + '...',
        apiHost: config.apiHost,
        clientId: this.clientId,
        debug: this.debug,
        autocapture: this.autocapture,
        enableCustomDomTracking: this.enableCustomDomTracking
      });

      try {
        // Pass options through to PostHog
        initializePostHog(config.apiKey, config.apiHost, {
          debug: this.debug,
          autocapture: this.autocapture,
          capture_pageview: config.capture_pageview ?? true,
          capture_pageleave: config.capture_pageleave ?? true,
          session_recording: config.session_recording
        });
        this.initialized = true;

        setTimeout(() => {
          this.setupTracking();

          if (window.posthog) {
            // Do not identify with an app-level client id. Store as super property instead.
            try { window.posthog.register({ client_id: this.clientId }); } catch {}
          }

          if (this.useBuiltInPageview) {
            this.trackPageView();
          }

          this.trackEvent('analytics_initialized', {
            version: VERSION,
            client_id: this.clientId
          });
        }, 500);

        console.log('✅ GenericAnalytics initialization complete');
      } catch (initError) {
        console.error('❌ PostHog initialization error:', initError);
      }
    },

    // Extract tokens from selectors to identify elements in before_send
    registerCustomSelector(selector) {
      try {
        const parts = String(selector)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        // Pre-tag now and for future DOM changes
        parts.forEach((s) => {
          tagNoAutocapture(s);
          observeAndTag(s);
          collectTokensFromSelector(s); // populate CustomTokens sets used by elementsMatchCustomTokens
        });

        // Also keep array tokens for class/id matching in before_send
        parts.forEach((part) => {
          const classMatches = [...part.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
          const idMatches = [...part.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
          classMatches.forEach((c) => this.customSelectorTokens.push({ type: 'class', value: c }));
          idMatches.forEach((i) => this.customSelectorTokens.push({ type: 'id', value: i }));
        });
      } catch {}
    },

    setupTracking() {
      console.log('🔧 Setting up tracking for', this.workflows.length, 'workflows');

      if (this.workflows && this.workflows.length > 0) {
        this.workflows.forEach(workflow => {
          this.setupWorkflowTracking(workflow);
        });
      }

      // Only add our own global DOM listeners when autocapture is off
      if (this.enableCustomDomTracking) {
        this.setupGlobalTracking();
      } else {
        console.log('ℹ️ Skipping custom DOM tracking (PostHog autocapture is enabled)');
      }
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

    setupWorkflowTracking(workflow) {
      if (!workflow.selector || !workflow.startEvent) {
        console.warn('Invalid workflow configuration:', workflow);
        return;
      }

      // Register selectors for suppression logic
      this.registerCustomSelector(workflow.selector);
      if (workflow.stepsSelectors?.length) {
        workflow.stepsSelectors.forEach((s) => s?.selector && this.registerCustomSelector(s.selector));
      }

      // Split complex selectors and add listeners for each
      const selectors = workflow.selector.split(',').map((s) => s.trim());
      selectors.forEach((selector) => {
        if (this.isValidSelector(selector)) {
          this.addDynamicListener(selector, 'click', (e) => {
            // mark element to skip future $autocapture
            try { e.target.classList?.add?.('ph-no-capture'); } catch {}
            this.trackEvent(workflow.startEvent, {
              workflow_name: workflow.name || 'unnamed_workflow',
              element_text: e.target.textContent?.trim().substring(0, 50),
              selector_used: selector
            });
          });
        } else {
          console.warn('Invalid selector in workflow:', selector, 'for workflow:', workflow.name);
        }
      });

      if (workflow.stepsSelectors && Array.isArray(workflow.stepsSelectors)) {
        workflow.stepsSelectors.forEach((step) => {
          if (step.selector && step.event) {
            const stepSelectors = step.selector.split(',').map((s) => s.trim());
            stepSelectors.forEach((selector) => {
              if (this.isValidSelector(selector)) {
                this.addDynamicListener(selector, step.eventType || 'click', (e) => {
                  try { e.target.classList?.add?.('ph-no-capture'); } catch {}
                  this.trackEvent(step.event, {
                    workflow_name: workflow.name || 'unnamed_workflow',
                    step_selector: selector,
                    element_text: e.target.textContent?.trim().substring(0, 50)
                  });
                });
              } else {
                console.warn('Invalid step selector:', selector, 'for workflow:', workflow.name);
              }
            });
          }
        });
      }
    },

    // Validate CSS selectors before using them
    isValidSelector(selector) {
      try {
        document.querySelector(selector);
        return true;
      } catch (e) {
        return false;
      }
    },

    setupGlobalTracking() {
      // Track form submissions
      this.addDynamicListener('form', 'submit', (e) => {
        const form = e.target;
        this.trackEvent('form_submitted', {
          form_class: form.className,
          form_id: form.id
        });
      });

      // Track button clicks - use simple selectors
      this.addDynamicListener('button', 'click', (e) => {
        const element = e.target;
        this.trackEvent('button_clicked', {
          element_type: 'button',
          element_class: element.className,
          element_text: element.textContent?.trim().substring(0, 50),
          element_id: element.id
        });
      });

      // Track input submit buttons
      this.addDynamicListener('input[type="submit"]', 'click', (e) => {
        const element = e.target;
        this.trackEvent('submit_button_clicked', {
          element_type: 'input_submit',
          element_class: element.className,
          element_value: element.value,
          element_id: element.id
        });
      });

      // Track links
      this.addDynamicListener('a', 'click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          this.trackEvent('link_clicked', {
            href: link.href,
            text: link.textContent?.trim().substring(0, 50),
            target: link.target,
            is_external: link.hostname !== window.location.hostname
          });
        }
      });
    },

    addDynamicListener(selector, eventType, handler) {
      try {
        // Validate selector first
        if (!this.isValidSelector(selector)) {
          console.warn('Skipping invalid selector:', selector);
          return;
        }

        if (eventType === 'click') {
          document.addEventListener('pointerdown', (e) => {
            try {
              let el = null;
              if (e.target.matches && e.target.matches(selector)) el = e.target;
              else if (e.target.closest) el = e.target.closest(selector);
              if (el) {
                el.classList?.add?.('ph-no-capture');
                el.setAttribute?.('data-ph-no-capture', 'true');
                window.__ga_lastCustomIntentAt = Date.now();
              }
            } catch {}
          }, true); // capture phase
        }

        document.addEventListener(eventType, (e) => {
          try {
            // Use a more robust matching approach
            let matchedElement = null;
            
            // First try direct match
            if (e.target.matches && e.target.matches(selector)) {
              matchedElement = e.target;
            }
            // Then try closest match
            else if (e.target.closest) {
              matchedElement = e.target.closest(selector);
            }

            if (matchedElement) {
              // Create a new event object with the matched element as target
              const modifiedEvent = {
                ...e,
                target: matchedElement,
                currentTarget: matchedElement
              };
              handler(modifiedEvent);
            }
          } catch (matchError) {
            console.warn('Error matching selector:', selector, matchError);
          }
        });
      } catch (listenerError) {
        console.warn('Error adding listener for selector:', selector, listenerError);
      }
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
