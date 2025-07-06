/**
 * Coach Matcher - Simplified for Database-Driven Assignment
 * Coaches are now pre-assigned to challenges in the database.
 * This file only contains utility functions for categories and reasons.
 */

/**
 * Get available categories for onboarding
 * @returns {Array} Array of category objects
 */
export function getAvailableCategories() {
  return [
    {
      code: 'addiction_recovery',
      label: 'Addiction & Recovery',
      description: 'Support for overcoming addictive behaviors and maintaining recovery',
      emoji: '🔄'
    },
    {
      code: 'mental_health',
      label: 'Mental Health',
      description: 'Help with anxiety, depression, stress, and emotional wellbeing',
      emoji: '🧠'
    }
  ];
}

/**
 * Get category-specific challenges
 * @param {string} categoryCode - Category code
 * @returns {Array} Array of challenge IDs for the category
 */
export function getCategorySpecificChallenges(categoryCode) {
  const categoryMappings = {
    'addiction_recovery': [
      'alcohol', 'drugs', 'porn', 'food_addiction', 'gambling', 'shopping'
    ],
    'mental_health': [
      'anxiety', 'depression', 'stress', 'grief', 'social_anxiety', 'trauma', 'self_esteem'
    ]
  };

  return categoryMappings[categoryCode] || [];
}

/**
 * Get explanation for database-assigned coach
 * @param {string} coachCode - The assigned coach code
 * @param {string} categoryCode - The category that determined the assignment
 * @returns {string} Human-readable assignment reason
 */
export function getCoachAssignmentReason(coachCode, categoryCode = null) {
  try {
    if (categoryCode) {
      const categoryName = categoryCode.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `Assigned specialized ${categoryName} specialist based on your selected challenges`;
    }

    switch (coachCode) {
      case 'mental_health_specialist':
        return 'Assigned Mental Health Specialist based on your mental health challenges';
      case 'addiction_recovery':
        return 'Assigned Addiction Recovery Specialist for specialized recovery support';
      case 'wellness':
        return 'Assigned General Wellness Coach for holistic health support';
      case 'fitness':
        return 'Assigned Fitness Coach for your movement and strength goals';
      case 'askme':
        return 'Assigned AskMe AI Coach for personalized guidance';
      default:
        return 'Coach assigned based on your selected challenges';
    }
  } catch (error) {
    console.error('Error in getCoachAssignmentReason:', error);
    return 'Coach assigned based on your profile';
  }
}

// Remove all the complex assignment logic and scoring weights
// These are no longer needed since coaches are assigned in the database