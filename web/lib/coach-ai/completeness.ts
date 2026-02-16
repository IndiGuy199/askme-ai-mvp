/**
 * Compute report completeness and missing metrics
 * Returns a structured analysis of what data is available vs. missing
 */

export interface MissingMetric {
  key: string;
  label: string;
  why_it_matters: string;
  how_to_fix: string;
  cta: {
    label: string;
    href: string;
  };
}

export interface SectionCoverage {
  available: boolean;
  pct: number;
  reasons: string[];
}

export interface ReportCompleteness {
  percent_complete: number;
  missing_metrics: MissingMetric[];
  coverage: {
    [sectionName: string]: SectionCoverage;
  };
}

export function computeReportCompleteness(metrics: any): ReportCompleteness {
  const missing: MissingMetric[] = [];
  const coverage: { [key: string]: SectionCoverage } = {};

  // Check action logs
  const hasActionLogs = metrics.meta?.sample_sizes?.actions > 0;
  const hasCompletions = metrics.meta?.sample_sizes?.completions >= 3;
  const hasUrgeData = (metrics.urge?.avg_before !== null && metrics.urge?.avg_after !== null);
  const hasSlipData = metrics.slips?.slip_count !== undefined;
  const hasRiskWindow = metrics.risk_window?.top_hours?.length > 0;
  const hasToolData = metrics.tools?.best_categories?.length > 0;
  const hasTrackBaseline = metrics.baselines?.track !== null && metrics.baselines?.track !== undefined;
  const hasGoalBaseline = metrics.baselines?.goal !== null && metrics.baselines?.goal !== undefined;

  // Debug logging
  console.log('📊 Completeness check:', {
    hasActionLogs,
    hasCompletions,
    hasUrgeData,
    hasRiskWindow,
    hasToolData,
    hasTrackBaseline,
    hasGoalBaseline,
    trackBaseline: metrics.baselines?.track,
    goalBaseline: metrics.baselines?.goal
  });

  // Activity section
  let activityPct = 0;
  const activityReasons = [];
  if (hasActionLogs) activityPct += 50;
  else activityReasons.push('No actions planned yet');
  if (hasCompletions) activityPct += 50;
  else activityReasons.push('No actions completed yet');
  
  coverage.activity = {
    available: hasActionLogs,
    pct: activityPct,
    reasons: activityReasons
  };

  if (!hasActionLogs) {
    missing.push({
      key: 'action_logs',
      label: 'Action Plans',
      why_it_matters: 'Actions are your experiments. Without them, we can\'t track what works.',
      how_to_fix: 'Generate 3 actions from AskMe AI on the Playbook page',
      cta: {
        label: 'Go to Playbook',
        href: '/playbook'
      }
    });
  }

  if (!hasCompletions) {
    missing.push({
      key: 'completions',
      label: 'Completion Logs',
      why_it_matters: 'Logging completions builds the pattern data for insights',
      how_to_fix: 'Mark actions as Done on the Playbook page (at least 3)',
      cta: {
        label: 'Log actions',
        href: '/playbook'
      }
    });
  }

  // Urge tracking section
  let urgePct = 0;
  const urgeReasons = [];
  if (hasUrgeData) urgePct = 100;
  else urgeReasons.push('No urge ratings logged');

  coverage.urge_tracking = {
    available: hasUrgeData,
    pct: urgePct,
    reasons: urgeReasons
  };

  if (!hasUrgeData) {
    missing.push({
      key: 'urge_data',
      label: 'Urge Before/After Ratings',
      why_it_matters: 'Urge ratings show which tools actually drop your urge level',
      how_to_fix: 'When logging completions, rate urge before (0-10) and after',
      cta: {
        label: 'Learn how',
        href: '/playbook'
      }
    });
  }

  // Risk window section
  let riskPct = 0;
  const riskReasons = [];
  if (hasRiskWindow) riskPct = 100;
  else if (hasCompletions) {
    riskPct = 50;
    riskReasons.push('Need more completion timestamps');
  } else {
    riskReasons.push('No completion logs yet');
  }

  coverage.risk_window = {
    available: hasRiskWindow,
    pct: riskPct,
    reasons: riskReasons
  };

  if (!hasRiskWindow && hasCompletions) {
    missing.push({
      key: 'risk_window',
      label: 'Risk Window Pattern',
      why_it_matters: 'Identifies your highest-risk hours to plan friction ahead',
      how_to_fix: 'Log more completions across different times of day',
      cta: {
        label: 'Continue logging',
        href: '/playbook'
      }
    });
  }

  // Tools effectiveness section
  let toolsPct = 0;
  const toolsReasons = [];
  if (hasToolData) {
    const avgSampleSize = metrics.tools.best_categories.reduce((sum: number, t: any) => sum + t.count, 0) / metrics.tools.best_categories.length;
    if (avgSampleSize >= 10) toolsPct = 100;
    else if (avgSampleSize >= 5) toolsPct = 75;
    else {
      toolsPct = 50;
      toolsReasons.push('Low sample size for tool scoring');
    }
  } else {
    toolsReasons.push('No tool usage data');
  }

  coverage.tools = {
    available: hasToolData,
    pct: toolsPct,
    reasons: toolsReasons
  };

  if (!hasToolData) {
    missing.push({
      key: 'tool_data',
      label: 'Tool Effectiveness Data',
      why_it_matters: 'Shows which action categories work best for you',
      how_to_fix: 'Complete actions with urge ratings in different categories',
      cta: {
        label: 'View actions',
        href: '/playbook'
      }
    });
  }

  // Baseline section
  let baselinePct = 0;
  const baselineReasons = [];
  if (hasTrackBaseline) baselinePct += 70;
  else baselineReasons.push('Track baseline not set');
  if (hasGoalBaseline) baselinePct += 30;
  else baselineReasons.push('Goal baseline not set');

  coverage.baselines = {
    available: hasTrackBaseline,
    pct: baselinePct,
    reasons: baselineReasons
  };

  if (!hasTrackBaseline) {
    missing.push({
      key: 'track_baseline',
      label: 'Track Baseline',
      why_it_matters: 'Your starting point for measuring progress over time',
      how_to_fix: 'Set your track baseline (slip frequency, triggers, etc.)',
      cta: {
        label: 'Set baseline',
        href: '/playbook'
      }
    });
  }

  // Compute overall completeness
  const sections = Object.values(coverage);
  const avgCompleteness = sections.reduce((sum, s) => sum + s.pct, 0) / sections.length;

  console.log('📊 Completeness calculation:', {
    sections: Object.entries(coverage).map(([name, cov]) => ({ name, pct: cov.pct })),
    total: Math.round(avgCompleteness),
    missing_count: missing.length
  });

  return {
    percent_complete: Math.round(avgCompleteness),
    missing_metrics: missing,
    coverage
  };
}

/**
 * Get confidence label for tool effectiveness data
 */
export function getToolConfidence(sampleSize: number): 'high' | 'medium' | 'low' {
  if (sampleSize >= 10) return 'high';
  if (sampleSize >= 5) return 'medium';
  return 'low';
}

/**
 * Format risk window label
 */
export function formatRiskWindowLabel(topHours: Array<{ hour: number; count: number; signal: string }>): string | null {
  if (!topHours || topHours.length === 0) return null;

  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}${ampm}`;
  };

  // Find continuous window
  const peakHour = topHours[0].hour;
  return `${formatHour(peakHour)}–${formatHour((peakHour + 2) % 24)}`;
}
