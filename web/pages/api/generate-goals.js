// generate-goals.js - Dedicated API endpoint for AI-suggested goals and actions
// This bypasses the chat system to prevent prompt override issues

const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Import error handler
const { withErrorHandling } = require('../../lib/apiErrorHandler');

async function generateGoalsHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, type, context } = req.body;

    if (!email || !type) {
      return res.status(400).json({ error: 'Missing required parameters: email, type' });
    }

    // Get user data with personalization preferences
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id, 
        first_name, 
        communication_style, 
        tone,
        tokens,
        coach_profiles (
          id,
          code,
          label
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('User lookup error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Check token balance
    if (user.tokens < 50) {
      return res.status(403).json({ 
        error: 'Insufficient tokens',
        required: 50,
        available: user.tokens
      });
    }

    // Get user's current goals and challenges for context
    const { data: userGoals } = await supabase
      .from('user_wellness_goals')
      .select(`
        coach_wellness_goals(goal_id, label, description)
      `)
      .eq('user_id', user.id);

    const { data: userChallenges } = await supabase
      .from('user_challenges')
      .select(`
        coach_challenges(challenge_id, label, description)
      `)
      .eq('user_id', user.id);

    // Build context for AI generation
    const goals = userGoals?.map(g => ({
      id: g.coach_wellness_goals?.goal_id,
      label: g.coach_wellness_goals?.label,
      description: g.coach_wellness_goals?.description
    })).filter(g => g.label) || [];

    const challenges = userChallenges?.map(c => ({
      id: c.coach_challenges?.challenge_id,
      label: c.coach_challenges?.label,
      description: c.coach_challenges?.description
    })).filter(c => c.label) || [];

    // Generate AI response based on type
    let prompt, expectedFormat;
    
    if (type === 'goals') {
      // Goals generation prompt
      prompt = buildGoalsPrompt(user, goals, challenges, context);
      expectedFormat = 'JSON array';
    } else if (type === 'action') {
      // Action suggestion prompt
      prompt = buildActionPrompt(user, context);
      expectedFormat = 'plain text';
    } else {
      return res.status(400).json({ error: 'Invalid type. Must be "goals" or "action"' });
    }

    console.log(`Generating ${type} for user ${user.first_name} (${email})`);
    console.log(`Prompt: ${prompt.substring(0, 200)}...`);

    // Call OpenAI API directly (bypassing chat system)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a wellness coach AI assistant. Provide helpful, personalized suggestions based on the user\'s context and preferences.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: type === 'goals' ? 800 : 400
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      return res.status(500).json({ error: 'No response from AI' });
    }

    // Calculate token usage
    const tokensUsed = completion.usage?.total_tokens || 100;
    const newTokenBalance = Math.max(0, user.tokens - tokensUsed);

    // Update user token balance
    await supabase
      .from('users')
      .update({ tokens: newTokenBalance })
      .eq('id', user.id);

    // Process response based on type
    let processedResponse;
    if (type === 'goals') {
      // Try to parse JSON response for goals
      try {
        processedResponse = JSON.parse(aiResponse);
        if (!Array.isArray(processedResponse)) {
          throw new Error('Response is not an array');
        }
      } catch (parseError) {
        console.error('Failed to parse goals JSON:', parseError);
        
        // Clean the response by removing markdown code blocks
        let cleanedResponse = aiResponse.trim();
        
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        cleanedResponse = cleanedResponse.replace(/^```(?:json)?\s*\n?/i, '');
        cleanedResponse = cleanedResponse.replace(/\n?```\s*$/i, '');
        cleanedResponse = cleanedResponse.trim();
        
        // Try parsing the cleaned response
        try {
          processedResponse = JSON.parse(cleanedResponse);
          if (!Array.isArray(processedResponse)) {
            throw new Error('Response is not an array');
          }
        } catch (secondParseError) {
          console.error('Failed to parse cleaned JSON:', secondParseError);
          
          // Final fallback: try to extract JSON array from response
          const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              processedResponse = JSON.parse(jsonMatch[0]);
              if (!Array.isArray(processedResponse)) {
                throw new Error('Extracted content is not an array');
              }
            } catch {
              return res.status(500).json({ error: 'Invalid JSON response from AI' });
            }
          } else {
            return res.status(500).json({ error: 'Could not extract valid JSON from AI response' });
          }
        }
      }
    } else {
      // Plain text response for actions
      processedResponse = aiResponse.trim();
    }

    console.log(`Successfully generated ${type}:`, 
      type === 'goals' ? `${processedResponse.length} goals` : `${processedResponse.length} chars`);

    return res.status(200).json({
      [type]: processedResponse,
      tokensUsed,
      remainingTokens: newTokenBalance
    });

  } catch (error) {
    console.error('Error in generate-goals API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// Build prompt for goals generation
function buildGoalsPrompt(user, currentGoals, currentChallenges, context) {
  const name = user.first_name || 'there';
  const style = user.communication_style || 'gentle-encouraging';
  const tone = user.tone || 'balanced';
  
  let prompt = `Hi ${name}! As your wellness coach, I'd like to suggest some personalized wellness goals for you.`;
  
  // Add user context
  if (context) {
    prompt += `\n\nContext: ${context}`;
  }
  
  // Add current goals and challenges for context
  if (currentGoals.length > 0) {
    prompt += `\n\nYour current goals: ${currentGoals.map(g => g.label).join(', ')}`;
  }
  
  if (currentChallenges.length > 0) {
    prompt += `\n\nYour current challenges: ${currentChallenges.map(c => c.label).join(', ')}`;
  }
  
  // Communication style adaptation
  const styleInstructions = {
    'direct': 'Be direct and to-the-point',
    'step-by-step': 'Provide detailed, actionable steps',
    'gentle-encouraging': 'Use gentle, encouraging language'
  };
  
  prompt += `\n\nPlease suggest 3-5 actionable wellness goals that would complement what I'm already working on. ${styleInstructions[style] || styleInstructions['gentle-encouraging']}.`;
  
  prompt += `\n\nIMPORTANT: Respond with ONLY a valid JSON array of objects. Each object should have "title" and "description" fields. No additional text or explanation.`;
  
  prompt += `\n\nExample format:
[
  {
    "title": "Daily Mindfulness Practice",
    "description": "Spend 10 minutes each morning practicing mindfulness meditation to reduce stress and improve focus"
  }
]`;

  return prompt;
}

// Build prompt for action suggestions
function buildActionPrompt(user, context) {
  const name = user.first_name || 'there';
  const style = user.communication_style || 'gentle-encouraging';
  const tone = user.tone || 'balanced';
  
  let prompt = `As a wellness coach, suggest one specific, actionable step.`;
  
  // Handle goal or challenge context
  if (context?.goalLabel) {
    prompt += `\n\nThis action is for the goal: "${context.goalLabel}"`;
  } else if (context?.challengeLabel) {
    prompt += `\n\nThis action is to help with the challenge: "${context.challengeLabel}"`;
  }
  
  // Add user tone preference
  if (context?.userTone) {
    prompt += `\n\nUser communication preference: ${context.userTone}`;
  }
  
  prompt += `\n\nThe suggestion should be:
- Concrete and doable today or this week
- Specific and measurable
- Motivating but achievable`;

  // Communication style adaptation
  const styleInstructions = {
    'direct': 'Be direct and to-the-point',
    'step-by-step': 'Provide a clear step-by-step action',
    'gentle-encouraging': 'Use gentle, encouraging language'
  };
  
  if (styleInstructions[style]) {
    prompt += `\n\n${styleInstructions[style]}.`;
  }
  
  prompt += `\n\nRespond with just the action suggestion (1-2 sentences, max 100 characters). No additional formatting or explanation.`;

  return prompt;
}

// Export with error handling
export default withErrorHandling(generateGoalsHandler);
