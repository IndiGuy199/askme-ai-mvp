/**
 * Algorithm to determine the best coach profile based on user's age and challenges
 * Age takes priority: Users over 45 automatically get "askme" coach
 * 
 * SIMPLIFIED APPROACH:
 * - Age 45+ → "askme" coach (specialized for life transitions)
 * - Mental health challenges → "mental_health" coach
 * - Fitness challenges → "fitness" coach  
 * - All other cases → "wellness" coach (general support)
 */

/*
 * OLD SCORING SYSTEM (preserved for reference if we want to expand algorithm later)
 * This was designed when users could select both goals and challenges
 */
export const COACH_SCORING_WEIGHTS = {
  // AskMe Coach indicators (for users over 45)
  askme: {
    goals: {
      'life_balance': 10,
      'health_maintenance': 10,
      'career_transition': 10,
      'relationship_growth': 8,
      'better_sleep': 6,
      'more_energy': 6,
      'stronger_habits': 6,
    },
    challenges: {
      'midlife_crisis': 10,
      'health_concerns': 10,
      'empty_nest': 10,
      'financial_stress': 8,
      'aging_parents': 8,
      'purpose_meaning': 8,
      'anxiety': 6,
      'depression': 6,
      'relationship_issues': 6,
    }
  },

  // Mental Health Coach indicators
  mental_health: {
    goals: {
      'emotional_balance': 10,
      'stress_relief': 8,
      'mindfulness': 8,
      'confidence': 6,
      'better_sleep': 3,
    },
    challenges: {
      'anxiety': 10,
      'depression': 10,
      'trauma': 10,
      'self_esteem': 8,
      'anger': 6,
      'grief': 6,
      'relationship_issues': 4,
    }
  },
  
  // Fitness Coach indicators
  fitness: {
    goals: {
      'build_muscle': 10,
      'lose_fat': 10,
      'improve_endurance': 10,
      'flexibility': 8,
      'lose_weight': 6,
      'more_energy': 4,
    },
    challenges: {
      'lack_motivation': 8,
      'injury_recovery': 10,
      'time_constraints': 6,
      'plateau': 8,
      'procrastination': 3,
    }
  },
  
  // Wellness Coach indicators (default/general)
  wellness: {
    goals: {
      'more_energy': 8,
      'better_sleep': 8,
      'stronger_habits': 10,
      'lose_weight': 8,
    },
    challenges: {
      'procrastination': 8,
      'relationship_issues': 6,
      'grief': 4,
    }
  }
};

/*
 * OLD SCORING FUNCTION (preserved for reference)
 * Calculate coach scores based on selected goals and challenges
 * @param {Array} selectedGoalIds - Array of goal_id strings from database
 * @param {Array} selectedChallengeIds - Array of challenge_id strings from database
 * @returns {Object} Scores for each coach type
 *
export function calculateCoachScores(selectedGoalIds = [], selectedChallengeIds = []) {
  const scores = {
    askme: 0,
    mental_health: 0,
    fitness: 0,
    wellness: 0
  };

  // Count how many goals/challenges match each coach type
  const matchCounts = {
    askme: { goals: 0, challenges: 0 },
    mental_health: { goals: 0, challenges: 0 },
    fitness: { goals: 0, challenges: 0 },
    wellness: { goals: 0, challenges: 0 }
  };

  // Score based on goals
  selectedGoalIds.forEach(goalId => {
    Object.keys(COACH_SCORING_WEIGHTS).forEach(coachType => {
      const goalScore = COACH_SCORING_WEIGHTS[coachType].goals[goalId] || 0;
      if (goalScore > 0) {
        scores[coachType] += goalScore;
        matchCounts[coachType].goals++;
      }
    });
  });

  // Score based on challenges
  selectedChallengeIds.forEach(challengeId => {
    Object.keys(COACH_SCORING_WEIGHTS).forEach(coachType => {
      const challengeScore = COACH_SCORING_WEIGHTS[coachType].challenges[challengeId] || 0;
      if (challengeScore > 0) {
        scores[coachType] += challengeScore;
        matchCounts[coachType].challenges++;
      }
    });
  });

  // Bonus points for multiple matches (shows strong preference for a coach type)
  Object.keys(matchCounts).forEach(coachType => {
    const goalMatches = matchCounts[coachType].goals;
    const challengeMatches = matchCounts[coachType].challenges;
    
    // Bonus for multiple goals matching this coach
    if (goalMatches >= 2) {
      scores[coachType] += (goalMatches - 1) * 2; // +2 for each additional goal
    }
    
    // Bonus for multiple challenges matching this coach
    if (challengeMatches >= 2) {
      scores[coachType] += (challengeMatches - 1) * 2; // +2 for each additional challenge
    }
    
    // Extra bonus if both goals AND challenges align with this coach
    if (goalMatches >= 1 && challengeMatches >= 1) {
      scores[coachType] += 5; // Strong alignment bonus
    }
  });

  return scores;
}
*/

/**
 * Determines the optimal coach based on user age and challenges only
 * Priority: Age > Mental Health Challenges > Fitness Challenges > Default Wellness
 */
export function determineOptimalCoach(challengeIds = [], age = null) {
  try {
    console.log('Coach Matcher Input:', { challengeIds, age });

    // AGE PRIORITY: Users over 45 get "askme" coach regardless of other selections
    if (age && age >= 45) {
      console.log('Age-based assignment: User is 45+, assigning askme coach');
      return 'askme';
    }

    // MENTAL HEALTH PRIORITY: If user has mental health challenges, assign mental health coach
    const mentalHealthChallenges = ['anxiety', 'depression', 'grief', 'anger', 'trauma', 'self_esteem'];
    const hasMentalHealthChallenges = challengeIds.some(challenge => 
      mentalHealthChallenges.includes(challenge)
    );

    if (hasMentalHealthChallenges) {
      console.log('Mental health challenge detected, assigning mental health coach');
      return 'mental_health';
    }

    // FITNESS PRIORITY: If user has fitness-related challenges, assign fitness coach
    const fitnessChallenges = ['lack_motivation', 'injury_recovery', 'plateau', 'time_constraints'];
    const hasFitnessChallenges = challengeIds.some(challenge => 
      fitnessChallenges.includes(challenge)
    );

    if (hasFitnessChallenges) {
      console.log('Fitness challenge detected, assigning fitness coach');
      return 'fitness';
    }

    // DEFAULT: General wellness coach for all other cases or no challenges selected
    console.log('No specific conditions met, assigning general wellness coach');
    return 'wellness';

  } catch (error) {
    console.error('Error in determineOptimalCoach:', error);
    return 'wellness'; // Safe fallback
  }
}

/**
 * Returns a human-readable explanation of why a coach was assigned
 */
export function getCoachAssignmentReason(coachCode, challengeIds = [], age = null) {
  try {
    switch (coachCode) {
      case 'askme':
        return `Assigned AskMe AI Coach because user is ${age} years old (45+ get specialized guidance for life transitions)`;
      case 'mental_health':
        const mentalChallenges = challengeIds.filter(c => ['anxiety', 'depression', 'grief', 'anger', 'trauma', 'self_esteem'].includes(c));
        return `Assigned Mental Health Coach due to challenges: ${mentalChallenges.join(', ')}`;
      case 'fitness':
        const fitnessChallenges = challengeIds.filter(c => ['lack_motivation', 'injury_recovery', 'plateau', 'time_constraints'].includes(c));
        return `Assigned Fitness Coach due to challenges: ${fitnessChallenges.join(', ')}`;
      case 'wellness':
      default:
        if (challengeIds.length > 0) {
          return `Assigned General Wellness Coach for holistic support with: ${challengeIds.join(', ')}`;
        }
        return 'Assigned General Wellness Coach for holistic health support';
    }
  } catch (error) {
    console.error('Error in getCoachAssignmentReason:', error);
    return 'Coach assigned based on user preferences';
  }
}