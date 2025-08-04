(function(window) {
  'use strict';

  const VERSION = '1.0.0';

  // Direct PostHog initialization using the official snippet
  function initializePostHog(apiKey, apiHost) {
    console.log('🔧 Initializing PostHog directly...');
    
    // Official PostHog snippet
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    
    // Initialize PostHog
    posthog.init(apiKey, {
      api_host: apiHost,
      debug: true,
      loaded: function(posthog) {
        console.log('✅ PostHog loaded successfully in callback');
      }
    });
    
    return true;
  }

  const GenericAnalytics = {
    version: VERSION,
    clientId: null,
    workflows: [],
    initialized: false,
    debug: false,

    init(config) {
      if (!config || !config.apiKey) {
        console.error('GenericAnalytics: Missing required apiKey in config');
        return;
      }

      this.clientId = config.clientId || 'askme-ai-app';
      this.workflows = config.workflows || [];
      this.debug = config.debug || false;

      console.log('🔧 GenericAnalytics initializing with:', {
        apiKey: config.apiKey.substring(0, 10) + '...',
        apiHost: config.apiHost,
        clientId: this.clientId,
        debug: this.debug
      });

      try {
        // Initialize PostHog directly
        initializePostHog(config.apiKey, config.apiHost);
        this.initialized = true;
        
        // Set up tracking after a delay to ensure PostHog is ready
        setTimeout(() => {
          this.setupTracking();
          
          // Identify the client
          if (window.posthog) {
            window.posthog.identify(this.clientId);
            
            // Send initialization event
            this.trackEvent('analytics_initialized', {
              version: VERSION,
              client_id: this.clientId
            });
          }
        }, 1000);
        
        console.log('✅ GenericAnalytics initialization complete');

      } catch (initError) {
        console.error('❌ PostHog initialization error:', initError);
      }
    },

    setupTracking() {
      console.log('🔧 Setting up tracking for', this.workflows.length, 'workflows');
      
      if (this.workflows && this.workflows.length > 0) {
        this.workflows.forEach(workflow => {
          this.setupWorkflowTracking(workflow);
        });
      }
      this.setupGlobalTracking();
    },

    setupWorkflowTracking(workflow) {
      if (!workflow.selector || !workflow.startEvent) {
        console.warn('Invalid workflow configuration:', workflow);
        return;
      }

      // Split complex selectors and add listeners for each
      const selectors = workflow.selector.split(',').map(s => s.trim());
      
      selectors.forEach(selector => {
        if (this.isValidSelector(selector)) {
          this.addDynamicListener(selector, 'click', (e) => {
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
        workflow.stepsSelectors.forEach(step => {
          if (step.selector && step.event) {
            const stepSelectors = step.selector.split(',').map(s => s.trim());
            
            stepSelectors.forEach(selector => {
              if (this.isValidSelector(selector)) {
                this.addDynamicListener(selector, step.eventType || 'click', (e) => {
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
        if (this.debug) {
          console.log('📊 Event tracked:', eventName, eventData);
        }
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
      return this.trackEvent('page_view', {
        page_url: url || window.location.href,
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
