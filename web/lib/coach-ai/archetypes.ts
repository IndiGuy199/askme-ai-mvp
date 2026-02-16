/**
 * Goal archetype classification and rotation for porn recovery
 */

export type GoalArchetype = 
  | 'POST_SLIP_CONTAINMENT'
  | 'BEDTIME_RISK_WINDOW'
  | 'ACCESS_PATHWAY_BLOCK'
  | 'BORED_ALONE_LOOP'
  | 'STRESS_ESCAPE'
  | 'FANTASY_SPIRAL'
  | 'ACCOUNTABILITY_BUILD';

export type ActionCategory =
  | 'DEVICE_FRICTION'
  | 'ENVIRONMENT_SHIFT'
  | 'ACCOUNTABILITY_PING'
  | 'TIME_PROTOCOL'
  | 'ANTI_BINGE_LOCK'
  | 'RECOVERY_REPAIR'
  | 'SHAME_REPAIR'
  | 'URGE_INTERRUPT';

export const ALL_GOAL_ARCHETYPES: GoalArchetype[] = [
  'POST_SLIP_CONTAINMENT',
  'BEDTIME_RISK_WINDOW',
  'ACCESS_PATHWAY_BLOCK',
  'BORED_ALONE_LOOP',
  'STRESS_ESCAPE',
  'FANTASY_SPIRAL',
  'ACCOUNTABILITY_BUILD'
];

export const ALL_ACTION_CATEGORIES: ActionCategory[] = [
  'DEVICE_FRICTION',
  'ENVIRONMENT_SHIFT',
  'ACCOUNTABILITY_PING',
  'TIME_PROTOCOL',
  'ANTI_BINGE_LOCK',
  'RECOVERY_REPAIR',
  'SHAME_REPAIR',
  'URGE_INTERRUPT'
];

/**
 * Classify goal archetype based on label keywords
 */
export function classifyGoalArchetype(goalLabel: string): GoalArchetype {
  const lower = goalLabel.toLowerCase();
  
  if (/second session|binge|after slip|spiral|recover|containment/i.test(lower)) {
    return 'POST_SLIP_CONTAINMENT';
  }
  if (/night|bed|sleep|10pm|late|evening|bedroom/i.test(lower)) {
    return 'BEDTIME_RISK_WINDOW';
  }
  if (/block|filter|safesearch|reddit|twitter|ig|search|incognito|apps/i.test(lower)) {
    return 'ACCESS_PATHWAY_BLOCK';
  }
  if (/bored|alone|lunch|idle|isolation/i.test(lower)) {
    return 'BORED_ALONE_LOOP';
  }
  if (/stress|anxiety|overwhelmed|after work|escape/i.test(lower)) {
    return 'STRESS_ESCAPE';
  }
  if (/fantasy|rehearse|loop in mind|mental|visualization/i.test(lower)) {
    return 'FANTASY_SPIRAL';
  }
  
  return 'ACCOUNTABILITY_BUILD';
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

interface UserMetrics {
  second_session_rate_30d?: number;
  common_risk_window?: string;
  common_location?: string;
  common_pathway?: string[];
  top_trigger?: string;
}

/**
 * Select 3 different archetypes for goal generation with rotation
 */
export function selectArchetypesForGeneration(
  existingGoals: Array<{ label: string; archetype?: string }>,
  userMetrics: UserMetrics
): GoalArchetype[] {
  // Get archetypes already in library
  const existingArchetypes = existingGoals.map(g => 
    (g.archetype as GoalArchetype) || classifyGoalArchetype(g.label)
  );
  
  // Priority rules based on user state
  const priorities: GoalArchetype[] = [];
  
  if (userMetrics.second_session_rate_30d && userMetrics.second_session_rate_30d > 0.5) {
    priorities.push('POST_SLIP_CONTAINMENT');
  }
  if (userMetrics.common_risk_window?.includes('pm') || userMetrics.common_location === 'bed') {
    priorities.push('BEDTIME_RISK_WINDOW');
  }
  if (userMetrics.common_pathway && userMetrics.common_pathway.length > 0) {
    priorities.push('ACCESS_PATHWAY_BLOCK');
  }
  if (userMetrics.top_trigger === 'bored_alone') {
    priorities.push('BORED_ALONE_LOOP');
  }
  if (userMetrics.top_trigger === 'stress' || userMetrics.top_trigger === 'anxiety') {
    priorities.push('STRESS_ESCAPE');
  }
  
  // Filter archetypes that aren't overused
  const availableArchetypes = ALL_GOAL_ARCHETYPES.filter(a => {
    const count = existingArchetypes.filter(ea => ea === a).length;
    return count < 2; // Allow up to 2 of each archetype
  });
  
  // Combine priorities + random selection
  const combined = [...new Set([...priorities, ...shuffleArray(availableArchetypes)])];
  const selected = combined.slice(0, 3);
  
  // Fallback: if we don't have 3, pad with shuffled archetypes
  if (selected.length < 3) {
    const remaining = shuffleArray(ALL_GOAL_ARCHETYPES.filter(a => !selected.includes(a)));
    selected.push(...remaining.slice(0, 3 - selected.length));
  }
  
  return selected;
}

/**
 * Select 3 different categories for action generation with rotation
 */
export function selectCategoriesForGeneration(
  goalArchetype: GoalArchetype,
  existingActions: string[]
): ActionCategory[] {
  // Archetype-specific mandatory categories
  const mandatoryByArchetype: Partial<Record<GoalArchetype, ActionCategory[]>> = {
    'POST_SLIP_CONTAINMENT': ['ANTI_BINGE_LOCK', 'SHAME_REPAIR', 'DEVICE_FRICTION'],
    'BEDTIME_RISK_WINDOW': ['DEVICE_FRICTION', 'TIME_PROTOCOL', 'ENVIRONMENT_SHIFT'],
    'ACCESS_PATHWAY_BLOCK': ['DEVICE_FRICTION', 'ACCOUNTABILITY_PING', 'TIME_PROTOCOL']
  };
  
  const mandatory = mandatoryByArchetype[goalArchetype];
  if (mandatory) {
    return mandatory;
  }
  
  // For other archetypes, rotate categories
  const shuffled = shuffleArray(ALL_ACTION_CATEGORIES);
  return shuffled.slice(0, 3);
}
