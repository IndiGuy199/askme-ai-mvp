/**
 * OpenAI client wrapper for Coach AI outputs
 * Separate from chat system - handles structured JSON generation with retry logic
 */
import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ModelCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call OpenAI with JSON mode and validate with zod schema
 * Includes retry logic if JSON is malformed
 */
export async function generateStructuredOutput<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodSchema<T>,
  model: string = 'gpt-4o-mini',
  maxRetries: number = 1
): Promise<ModelCallResult<T>> {
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt <= maxRetries) {
    try {
      console.log(`🤖 Coach AI call attempt ${attempt + 1}, model: ${model}`);

      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9, // Higher for more variety
        max_tokens: 2000 // Increased for 3 goals
      });

      const rawContent = completion.choices[0]?.message?.content;

      if (!rawContent) {
        throw new Error('Empty response from OpenAI');
      }

      // Parse JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON: ${parseError}`);
      }

      // Validate with zod
      const validated = schema.parse(parsed);

      const usage = completion.usage;
      console.log(`✅ Coach AI success: ${usage?.total_tokens || 0} tokens`);

      return {
        success: true,
        data: validated,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0
        }
      };

    } catch (error: any) {
      lastError = error.message || String(error);
      console.error(`❌ Coach AI attempt ${attempt + 1} failed:`, lastError);

      // If zod validation failed, try one more time with a fix prompt
      if (attempt < maxRetries && lastError.includes('Invalid')) {
        attempt++;
        userPrompt += '\n\nIMPORTANT: Previous response was invalid. Ensure strict JSON format with exact field names and types.';
        continue;
      }

      break;
    }
  }

  // All retries failed, return fallback
  console.error('❌ Coach AI failed after retries');
  return {
    success: false,
    error: lastError || 'Unknown error'
  };
}

/**
 * Fallback generators if model fails
 */
export function getFallbackGoals(challengeId: string, severity: string): any {
  return {
    challenge_id: challengeId,
    severity,
    goals: [
      {
        label: 'Build awareness of my patterns',
        description: 'Track when urges appear and what triggers them to identify your top 3 patterns.',
        goal_type: 'track',
        suggested_duration_days: 30,
        why_this_now: 'Understanding patterns is the first step to lasting change.'
      }
    ]
  };
}

export function getFallbackActions(goalId: string): any {
  return {
    goal_id: goalId,
    actions: [
      {
        title: 'Take 3 deep breaths when urge appears',
        duration_minutes: 2,
        difficulty: 'easy',
        category: 'urge',
        success_criteria: 'Complete 3 full breath cycles (4 seconds in, 4 out)',
        when_to_do: 'When you feel an urge building',
        why_this: 'Creates a pause before acting on impulse.'
      }
    ]
  };
}

export function getFallbackInsights(challengeId: string): any {
  return {
    challenge_id: challengeId,
    timeframe_days: 7,
    insights: {
      risk_window: 'Not enough data yet',
      best_tool: 'Still learning your patterns',
      best_lever: 'environment'
    },
    next_week_plan: {
      keep: ['Track your patterns daily', 'Use the tools when urges appear'],
      change: ['Add more structure to high-risk times', 'Increase environmental friction'],
      try: ['One new grounding technique', 'Connect with support person']
    }
  };
}
