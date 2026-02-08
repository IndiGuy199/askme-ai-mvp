import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import WeeklyAnalyticsCard from '../components/WeeklyAnalyticsCard';
import { supabase } from '../utils/supabaseClient';

export default function AnalyticsDashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user);
      } catch (error) {
        console.error('Error getting user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <Layout title="Analytics Dashboard">
        <div className="container-fluid py-4">
          <div className="d-flex justify-content-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout title="Analytics Dashboard">
        <div className="container-fluid py-4">
          <div className="alert alert-warning">
            <h5>Authentication Required</h5>
            <p>Please log in to view your analytics dashboard.</p>
            <a href="/login" className="btn btn-primary">Go to Login</a>
          </div>
        </div>
      </Layout>
    );
  }

  // Use user email as client ID (or any unique identifier)
  const clientId = user.email || user.id;

  return (
    <Layout title="Analytics Dashboard">
      <div className="container-fluid py-4">
        {/* Header */}
        <div className="row mb-4">
          <div className="col">
            <h1 className="h2 mb-1">📊 Analytics Dashboard</h1>
            <p className="text-muted">
              Your wellness app usage insights and progress tracking
            </p>
          </div>
        </div>

        {/* PostHog Status Check */}
        <div className="row mb-4">
          <div className="col">
            <div className="alert alert-info">
              <div className="d-flex align-items-center">
                <i className="bi bi-info-circle me-2"></i>
                <div>
                  <strong>Analytics Status:</strong>
                  <div className="mt-1">
                    <span className="badge bg-primary me-2">PostHog Key: {process.env.NEXT_PUBLIC_POSTHOG_KEY ? '✓ Configured' : '✗ Missing'}</span>
                    <span className="badge bg-secondary me-2">Host: {process.env.NEXT_PUBLIC_POSTHOG_HOST || 'Default'}</span>
                    <span className="badge bg-success">Client ID: {clientId}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Cards Grid */}
        <div className="row g-4">
          {/* Weekly Overview */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="Weekly Overview"
              clientId={clientId}
              dateRange={7}
              comparisonMode="previous"
            />
          </div>

          {/* Monthly Overview */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="Monthly Overview"
              clientId={clientId}
              dateRange={30}
              comparisonMode="previous"
            />
          </div>

          {/* User Engagement */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="User Engagement"
              clientId={clientId}
              dateRange={7}
              comparisonMode="none"
            />
          </div>

          {/* Chat Activity */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="Chat Activity"
              clientId={clientId}
              dateRange={14}
              comparisonMode="previous"
            />
          </div>

          {/* Goal Progress */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="Goal Progress"
              clientId={clientId}
              dateRange={30}
              comparisonMode="none"
            />
          </div>

          {/* Page Views */}
          <div className="col-12 col-md-6 col-xl-4">
            <WeeklyAnalyticsCard
              title="Page Views"
              clientId={clientId}
              dateRange={7}
              comparisonMode="previous"
            />
          </div>
        </div>

        {/* Test PostHog Connection */}
        <div className="row mt-4">
          <div className="col">
            <div className="card">
              <div className="card-header">
                <h5 className="card-title mb-0">
                  <i className="bi bi-tools me-2"></i>
                  PostHog Connection Test
                </h5>
              </div>
              <div className="card-body">
                <p className="text-muted mb-3">
                  Test your PostHog configuration to ensure analytics are working properly.
                </p>
                <div className="d-flex gap-2 flex-wrap">
                  <button 
                    className="btn btn-outline-primary"
                    onClick={() => {
                      if (window.posthog) {
                        window.posthog.capture('test_event', {
                          source: 'analytics_dashboard',
                          timestamp: new Date().toISOString()
                        });
                        alert('Test event sent to PostHog!');
                      } else {
                        alert('PostHog is not available on this page');
                      }
                    }}
                  >
                    <i className="bi bi-send me-1"></i>
                    Send Test Event
                  </button>
                  <button 
                    className="btn btn-outline-info"
                    onClick={() => {
                      console.log('PostHog status:', {
                        available: !!window.posthog,
                        config: window.posthog?.config,
                        distinctId: window.posthog?.get_distinct_id?.()
                      });
                      alert('Check browser console for PostHog status');
                    }}
                  >
                    <i className="bi bi-bug me-1"></i>
                    Debug PostHog
                  </button>
                  <button 
                    className="btn btn-outline-secondary"
                    onClick={() => window.location.reload()}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="row mt-5">
          <div className="col text-center">
            <small className="text-muted">
              Analytics powered by PostHog • Last updated: {new Date().toLocaleString()}
            </small>
          </div>
        </div>
      </div>
    </Layout>
  );
}
