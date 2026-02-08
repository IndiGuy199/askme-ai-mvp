import React, { useState, useEffect } from 'react';
import styles from '../styles/Analytics.module.css';

export default function WeeklyAnalyticsCard({ 
  title, 
  clientId, 
  dateRange = 7, 
  comparisonMode = 'none' 
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!clientId) {
        setData(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Set a timeout to prevent infinite loading
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/analytics/weekly', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, dateRange, comparisonMode }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Failed to fetch analytics: ${response.status}`);
        }

        const result = await response.json();
        
        // Handle both success with no data and actual data
        if (result.success) {
          setData(result.data || null);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('WeeklyAnalyticsCard fetch error:', err);
        if (err.name === 'AbortError') {
          setError('Request timed out - PostHog may be unavailable');
        } else {
          setError(err.message);
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clientId, dateRange, comparisonMode]);

  // Always render the card structure
  return (
    <div className={`${styles.weeklyAnalyticsCard} card shadow-sm h-100`}>
      <div className="card-header bg-light">
        <h5 className="card-title mb-0">
          <i className="bi bi-graph-up me-2"></i>
          {title}
        </h5>
      </div>
      
      <div className="card-body d-flex flex-column justify-content-center">
        {loading ? (
          <div className={`${styles.loadingState} text-center py-4`}>
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="text-muted mb-0">Loading analytics...</p>
            <small className="text-muted">Fetching data from PostHog...</small>
          </div>
        ) : error ? (
          <div className={`${styles.errorState} text-center py-4`}>
            <div className="text-danger mb-3">
              <i className="bi bi-exclamation-triangle fs-2"></i>
            </div>
            <h6 className="text-danger mb-2">Data Unavailable</h6>
            <p className="text-muted small mb-3">{error}</p>
            <button 
              className="btn btn-outline-primary btn-sm"
              onClick={() => window.location.reload()}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>
              Retry
            </button>
          </div>
        ) : !data || (Array.isArray(data) && data.length === 0) ? (
          <div className={`${styles.noDataState} text-center py-4`}>
            <div className="text-muted mb-3">
              <i className="bi bi-bar-chart fs-2"></i>
            </div>
            <h6 className="text-muted mb-2">No Data Available</h6>
            <p className="text-muted small mb-2">
              No analytics data found for the last {dateRange} days.
            </p>
            <div className="alert alert-info py-2 px-3 small">
              <i className="bi bi-info-circle me-1"></i>
              Data will appear once user interactions are tracked by PostHog.
            </div>
          </div>
        ) : (
          <div className={styles.dataContent}>
            {/* Sample data visualization */}
            <div className="row g-3">
              <div className="col-6">
                <div className="text-center">
                  <div className="h4 text-primary mb-1">{data.totalEvents || 0}</div>
                  <small className="text-muted">Total Events</small>
                </div>
              </div>
              <div className="col-6">
                <div className="text-center">
                  <div className="h4 text-success mb-1">{data.uniqueUsers || 0}</div>
                  <small className="text-muted">Unique Users</small>
                </div>
              </div>
              <div className="col-12">
                <div className="progress" style={{ height: '6px' }}>
                  <div 
                    className="progress-bar bg-primary" 
                    style={{ width: `${Math.abs(data.growth || 0)}%` }}
                  ></div>
                </div>
                <small className="text-muted">Growth: {data.growth || 0}%</small>
              </div>
            </div>
            
            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-3">
                <summary className="text-muted small">Debug Data</summary>
                <pre className="small text-muted mt-2" style={{ fontSize: '0.7rem' }}>
                  {JSON.stringify(data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
      
      <div className="card-footer bg-light">
        <small className="text-muted">
          <i className="bi bi-clock me-1"></i>
          Last updated: {new Date().toLocaleTimeString()}
        </small>
      </div>
    </div>
  );
}
