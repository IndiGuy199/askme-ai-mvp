/**
 * Alignment utilities for seed-based AI generation
 * Ensures AI outputs match user-entered seed text intent
 */

/**
 * Simple keyword-based similarity check
 * Returns true if seed and output share meaningful keywords
 */
function hasKeywordOverlap(seed: string, output: string): boolean {
  // Normalize both strings
  const normalizeSeed = seed.toLowerCase().trim();
  const normalizeOutput = output.toLowerCase().trim();

  // Extract significant words (3+ chars, not common stop words)
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'are', 'was',
    'were', 'been', 'not', 'but', 'what', 'all', 'when', 'one', 'two', 'can',
    'will', 'just', 'dont', 'your', 'their', 'about', 'out', 'off', 'you'
  ]);

  const extractKeywords = (text: string): Set<string> => {
    return new Set(
      text
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length >= 3 && !stopWords.has(word))
    );
  };

  const seedKeywords = extractKeywords(normalizeSeed);
  const outputKeywords = extractKeywords(normalizeOutput);

  // Check for overlap
  let matchCount = 0;
  for (const keyword of seedKeywords) {
    if (outputKeywords.has(keyword)) {
      matchCount++;
    }
  }

  // Require at least 30% overlap or 2 keyword matches (whichever is lower)
  const overlapRatio = matchCount / Math.max(seedKeywords.size, 1);
  return overlapRatio >= 0.3 || matchCount >= 2;
}

/**
 * Check if goal suggestions align with seed intent
 */
export function checkGoalAlignment(
  seedTitle: string | undefined,
  seedDescription: string | undefined,
  goals: Array<{ label: string; description?: string }>
): { aligned: boolean; matchCount: number; reason?: string } {
  // No seed = no alignment check needed
  if (!seedTitle && !seedDescription) {
    return { aligned: true, matchCount: goals.length };
  }

  const seedText = `${seedTitle || ''} ${seedDescription || ''}`.trim();
  
  if (!seedText) {
    return { aligned: true, matchCount: goals.length };
  }

  // Count how many goals match the seed
  let matchCount = 0;
  for (const goal of goals) {
    const goalText = `${goal.label} ${goal.description || ''}`;
    if (hasKeywordOverlap(seedText, goalText)) {
      matchCount++;
    }
  }

  // Require at least 2 out of 3 goals to match
  const aligned = matchCount >= 2;
  
  if (!aligned) {
    return {
      aligned: false,
      matchCount,
      reason: `Only ${matchCount} out of ${goals.length} goals matched the seed intent. Expected at least 2.`
    };
  }

  return { aligned: true, matchCount };
}

/**
 * Check if action suggestions align with seed intent
 */
export function checkActionAlignment(
  seedText: string | undefined,
  actions: Array<{ title: string; ai_note?: string }>
): { aligned: boolean; matchCount: number; reason?: string } {
  // No seed = no alignment check needed
  if (!seedText || seedText.trim().length === 0) {
    return { aligned: true, matchCount: actions.length };
  }

  const normalizedSeed = seedText.trim();

  // Count how many actions match the seed
  let matchCount = 0;
  for (const action of actions) {
    const actionText = `${action.title} ${action.ai_note || ''}`;
    if (hasKeywordOverlap(normalizedSeed, actionText)) {
      matchCount++;
    }
  }

  // Require at least 2 out of 3 actions to match
  const aligned = matchCount >= 2;
  
  if (!aligned) {
    return {
      aligned: false,
      matchCount,
      reason: `Only ${matchCount} out of ${actions.length} actions matched the seed intent. Expected at least 2.`
    };
  }

  return { aligned: true, matchCount };
}

/**
 * Build retry prompt when alignment fails
 */
export function buildRetryPrompt(
  originalPrompt: string,
  seedText: string,
  failureReason: string
): string {
  return `${originalPrompt}

RETRY NOTICE: Your previous output did not match the user's seed intent.
Seed text: "${seedText}"
Failure reason: ${failureReason}

Try again with outputs that are MUCH CLOSER to the seed text. Focus on the core intent and mechanism described by the user.`;
}
