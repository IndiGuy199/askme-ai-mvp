/**
 * POST /api/coach/protocol
 * Generate urge support protocol (Support Now feature)
 * Uses Coach AI structured generation system
 */
import { generateStructuredOutput } from '../../../lib/coach-ai/client';
import { ProtocolResponseSchema } from '../../../lib/coach-ai/schema';
import { buildProtocolPrompt } from '../../../lib/coach-ai/prompts';

export default async function handler(req: any, res: any) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers for POST
  res.setHeader('Access-Control-Allow-Origin', '*');

  console.log('🚨 Protocol endpoint called');

  try {
    const { durationMinutes, track, intensity, context } = req.body;
    console.log('📥 Request body:', { durationMinutes, track, intensity, context });

    // Validation
    if (!durationMinutes || ![2, 5].includes(durationMinutes)) {
      console.log('❌ Invalid duration');
      return res.status(400).json({ error: 'Duration must be 2 or 5 minutes' });
    }

    if (!track || !['porn', 'sex', 'food'].includes(track)) {
      console.log('❌ Invalid track');
      return res.status(400).json({ error: 'Track must be porn, sex, or food' });
    }

    console.log('✅ Validation passed');
    console.log('🚨 Generating urge protocol via Coach AI:', { 
      track, 
      duration: durationMinutes,
      intensity: intensity || 'not specified',
      context: context || 'not specified'
    });

    // Build prompt using Coach AI system
    console.log('📝 Building prompt context...');
    const promptContext = {
      track,
      durationMinutes,
      intensity: intensity || undefined,
      context: context || undefined
    };

    const systemPrompt = `You are a porn addiction recovery specialist. Not a wellness coach. Not a therapist. A specialist who understands compulsive porn use, escalation, fantasy loops, and the autopilot brain.

Output strict JSON only. No markdown. No commentary.

Never instruct turning off the device or deleting apps. The user needs this device for support.

CRITICAL DURATION RULES:
- If duration_minutes = 2: total step seconds MUST be between 90 and 120. Count carefully.
- If duration_minutes = 5: total step seconds MUST be between 240 and 300. Count carefully.
- Before outputting, add up every step.seconds value. If the sum is outside the range, adjust step durations until it fits. This is non-negotiable.

INTENSITY RULES:
- Low (1-3): awareness & prevention. Reflective. Planning. Longer steps OK.
- Medium (4-6): interrupt & delay. Mix of grounding + cognitive interrupt + behavior change.
- High (7-10): containment & damage control. The goal is survival, not growth.
  * NO breathing longer than 15 seconds
  * NO breath holds
  * Breathing MUST be paired with movement (never standalone)
  * MUST include body movement (stand, walk, stretch, push-ups)
  * MUST include environment change (leave room, change lighting, move away from bed)
  * Use firm, directive, authoritative language
  * Frame success as delay: "Delay is the win." "Even a pause weakens the loop."
  * Do NOT say "reflect" or "journal" or "think about how you feel"

PORN-SPECIFIC RULES (every protocol must follow):
- Include at least ONE porn-loop reference: "peeking," "fantasy spiral," "escalation," "autopilot," "just one more," "tab-switch trance," "second session"
- Never rely on reflection or journaling as a main step
- Friction must involve BODY or ENVIRONMENT, not just phone orientation
  * Bad: "place phone face down"
  * Good: "stand up, leave phone on table, walk to kitchen"
  * Good: "splash cold water on face"
  * At intensity >=6: friction MUST be body/environment, not phone-only

REDIRECT RULES:
- Redirects must be: concrete, physical or sensory, time-boxed, NOT reflective
- Bad: "think of an activity you enjoy" / "reflect on how you feel" / "plan your next healthy step"
- Good: "count 5 red objects in the room" / "splash cold water on your wrists" / "do 10 jumping jacks" / "text one person right now"

CLOSE MESSAGE RULES:
- close.instruction is REQUIRED, never omit it
- Do NOT say "you did well" or "you are doing great" or "good job"
- DO say things like: "You bought time. That counts." / "Even a pause weakens the loop." / "If the urge dropped 1 notch, you succeeded." / "The urge had a moment. You did not give it the hour."

Tone: calm, direct, non-shaming, firm at high intensity. Coach-in-your-ear. No moralizing.`;

    console.log('📝 Building user prompt...');
    const userPrompt = buildProtocolPrompt(promptContext);
    console.log('✅ Prompt built successfully');

    // Generate via Coach AI client with retry logic
    console.log('🤖 Calling generateStructuredOutput...');
    const result = await generateStructuredOutput(
      systemPrompt,
      userPrompt,
      ProtocolResponseSchema,
      'gpt-4o',
      2 // Allow 2 retries for protocol generation
    );
    console.log('✅ generateStructuredOutput completed');

    if (!result.success || !result.data) {
      console.error('❌ Coach AI protocol generation failed:', result.error);
      
      // Return fallback protocol
      console.log('🔄 Using fallback protocol');
      const fallbackProtocol = generateFallbackProtocol(durationMinutes, track, intensity, context);
      return res.status(200).json(fallbackProtocol);
    }

    console.log('✅ Protocol generated successfully via Coach AI');
    console.log('📊 Token usage:', result.usage);

    // Post-generation duration validation + padding
    const lowerBound = durationMinutes === 2 ? 90 : 240;
    const upperBound = durationMinutes === 2 ? 120 : 300;
    let steps = [...result.data.steps];
    let totalSec = steps.reduce((s: number, st: any) => s + st.seconds, 0);
    console.log(`📏 Duration check: ${totalSec}s (expected ${lowerBound}-${upperBound}s)`);

    // Pad if under lower bound
    if (totalSec < lowerBound) {
      const isHigh = intensity && intensity >= 7;
      const padPool = isHigh ? [
        { id: 'step_pad_1', title: 'Wall push-ups', instruction: 'Do 10 wall push-ups right now. Physical effort drains the urge.', seconds: 30, category: 'redirect' },
        { id: 'step_pad_2', title: 'Cold shock', instruction: 'Run cold water over your wrists for 15 seconds. Shock the autopilot.', seconds: 25, category: 'grounding' },
        { id: 'step_pad_3', title: 'Count objects', instruction: 'Count 5 blue objects in the room. Say each one out loud.', seconds: 20, category: 'interrupt' },
        { id: 'step_pad_4', title: 'Lock the hour', instruction: 'Name one concrete thing you will do in the next 60 minutes. Say it now.', seconds: 25, category: 'stabilize' },
        { id: 'step_pad_5', title: 'Text someone', instruction: 'Open your messages and text one person. Just say hi. Break isolation.', seconds: 30, category: 'redirect' },
        { id: 'step_pad_6', title: 'Delay wins', instruction: 'Every second of delay weakens the loop. Stay standing. Keep moving.', seconds: 20, category: 'stabilize' },
      ] : [
        { id: 'step_pad_1', title: 'Write the trigger', instruction: 'Write down what triggered this urge in 1 sentence. Pen or notes app.', seconds: 30, category: 'interrupt' },
        { id: 'step_pad_2', title: 'Prevention plan', instruction: 'What will you change tonight to reduce risk? Move phone charger, set a timer, or text an accountability partner.', seconds: 40, category: 'stabilize' },
        { id: 'step_pad_3', title: 'Body scan', instruction: 'Close your eyes for 15 seconds. Notice tension in shoulders, jaw, hands. Release it.', seconds: 30, category: 'grounding' },
        { id: 'step_pad_4', title: 'Name the pattern', instruction: 'Which pattern is this? Boredom, loneliness, stress, or autopilot? Naming it reduces its power.', seconds: 25, category: 'interrupt' },
        { id: 'step_pad_5', title: 'Glass of water', instruction: 'Go get a full glass of water. Drink it slowly. Small actions reset big loops.', seconds: 30, category: 'redirect' },
        { id: 'step_pad_6', title: 'Next hour anchor', instruction: 'Pick one real activity for the next hour. Walking, cooking, calling someone. Commit out loud.', seconds: 30, category: 'stabilize' },
      ];

      let padIdx = 0;
      while (totalSec < lowerBound && padIdx < padPool.length) {
        const pad = { ...padPool[padIdx] } as typeof steps[number];
        const needed = lowerBound - totalSec;
        pad.seconds = Math.min(pad.seconds, Math.max(15, needed));
        steps.push(pad);
        totalSec += pad.seconds;
        padIdx++;
      }
      // If still short, stretch last step
      if (totalSec < lowerBound && steps.length > 0) {
        const deficit = lowerBound - totalSec;
        steps[steps.length - 1].seconds += deficit;
        totalSec += deficit;
      }
      console.log(`📏 Padded to ${totalSec}s`);
    }

    // Trim if over upper bound (reduce longest steps)
    if (totalSec > upperBound) {
      while (totalSec > upperBound) {
        const longest = steps.reduce((max: any, s: any) => s.seconds > max.seconds ? s : max, steps[0]);
        const excess = totalSec - upperBound;
        const trim = Math.min(excess, longest.seconds - 15);
        if (trim <= 0) break;
        longest.seconds -= trim;
        totalSec -= trim;
      }
      console.log(`📏 Trimmed to ${totalSec}s`);
    }

    // Ensure close.instruction exists
    const closeMsg = result.data.close?.instruction || 'You interrupted the cycle. That took strength. Now do one thing with the next hour.';

    // Map Coach AI response to expected format for UI
    const protocol = {
      sessionId: result.data.id,
      title: result.data.title,
      coachPersona: result.data.coach_persona || 'Porn Recovery Specialist',
      durationMinutes,
      track,
      intensity: intensity || null,
      context: context || null,
      steps,
      close: { instruction: closeMsg },
      totalSeconds: totalSec
    };

    console.log('📤 Returning protocol');
    return res.status(200).json(protocol);

  } catch (error: any) {
    console.error('❌ Error in protocol endpoint:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Return error details for debugging
    return res.status(500).json({ 
      error: 'Protocol generation failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Fallback protocol if AI fails
 */
function generateFallbackProtocol(durationMinutes: number, track: string, intensity?: number, context?: string) {
  const steps = durationMinutes === 2
    ? [
        {
          id: 'step_1',
          title: 'Feet on floor',
          instruction: 'Sit up. Feet flat on the ground. One breath, 4 seconds in, 4 out.',
          seconds: 15,
          category: 'grounding' as const
        },
        {
          id: 'step_2',
          title: 'Name the loop',
          instruction: 'Say it: "I am in a peek spiral" or "I am chasing fantasy." Name breaks the trance.',
          seconds: 20,
          category: 'interrupt' as const
        },
        {
          id: 'step_3',
          title: 'Phone face down',
          instruction: 'Put the phone face down for 10 seconds. Stand up. Change your eye line.',
          seconds: 25,
          category: 'friction' as const
        },
        {
          id: 'step_4',
          title: 'Move and redirect',
          instruction: 'Walk to another room or splash cold water on your face. Break the scene.',
          seconds: 35,
          category: 'redirect' as const
        }
      ]
    : [
        {
          id: 'step_1',
          title: 'Sit up, ground',
          instruction: 'Feet flat. Press them into the floor. One breath cycle.',
          seconds: 15,
          category: 'grounding' as const
        },
        {
          id: 'step_2',
          title: 'Name the pattern',
          instruction: 'Say what is happening: "peeking," "scrolling on autopilot," "fantasy loop."',
          seconds: 25,
          category: 'interrupt' as const
        },
        {
          id: 'step_3',
          title: 'Create friction',
          instruction: 'Phone face down. Stand up. Move 10 feet from where you were.',
          seconds: 30,
          category: 'friction' as const
        },
        {
          id: 'step_4',
          title: 'Body reset',
          instruction: 'Splash cold water on your face or hold ice. Shock the loop.',
          seconds: 40,
          category: 'grounding' as const
        },
        {
          id: 'step_5',
          title: 'Redirect action',
          instruction: 'Text someone. Step outside. Put on shoes. Do one physical thing.',
          seconds: 50,
          category: 'redirect' as const
        },
        {
          id: 'step_6',
          title: 'Lock in next hour',
          instruction: 'Pick one thing to do in the next 60 minutes. Say it out loud.',
          seconds: 40,
          category: 'stabilize' as const
        },
        {
          id: 'step_7',
          title: 'Close the door',
          instruction: 'The urge had a moment. You did not give it the hour. Move forward.',
          seconds: 40,
          category: 'stabilize' as const
        }
      ];

  return {
    sessionId: `fallback-${Date.now()}`,
    title: 'Urge Interruption Protocol',
    coachPersona: 'Porn Recovery Specialist',
    durationMinutes,
    track,
    intensity: intensity || null,
    context: context || null,
    steps,
    close: {
      instruction: 'You interrupted the cycle. That took strength. Now do one thing with the next hour.'
    },
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0)
  };
}
