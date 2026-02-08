import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Validation rules
const DURATION_RULES = {
  2: { minSteps: 3, maxSteps: 5, minSeconds: 90, maxSeconds: 120 },
  5: { minSteps: 5, maxSteps: 8, minSeconds: 240, maxSeconds: 300 }
};

// Track-specific guidance
const TRACK_PROMPTS = {
  porn: {
    prefix: "Pornography addiction recovery",
    focus: "redirecting attention, disrupting triggers, building healthy alternative behaviors"
  },
  sex: {
    prefix: "Sexual compulsivity management",
    focus: "emotional regulation, boundary awareness, healthy intimacy concepts"
  },
  food: {
    prefix: "Emotional eating intervention",
    focus: "mindful awareness, hunger vs. emotion differentiation, self-compassion"
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { durationMinutes, track, intensity, context } = req.body;

    // Validation
    if (!durationMinutes || ![2, 5].includes(durationMinutes)) {
      return res.status(400).json({ error: 'Duration must be 2 or 5 minutes' });
    }

    if (!track || !['porn', 'sex', 'food'].includes(track)) {
      return res.status(400).json({ error: 'Track must be porn, sex, or food' });
    }

    const rules = DURATION_RULES[durationMinutes];
    const trackInfo = TRACK_PROMPTS[track];

    // Generate protocol with GPT-4
    const systemPrompt = `You are a trauma-informed addiction recovery coach designing ultra-short, guided urge protocols for a mobile UI.
Output MUST be valid JSON only (no markdown, no commentary).
Tone: calm, non-judgmental, practical, brief. Avoid shame, moralizing, or clinical jargon.
Do NOT include explicit sexual content. Use neutral terms ("urge", "trigger", "compulsion").
Steps must be actionable and timed for a one-step-at-a-time experience.
Each instruction must be 1–2 short lines max (no paragraphs).
You MUST tailor protocols by track (porn vs sex vs food) so they feel meaningfully different.
You MUST obey step count and timing constraints exactly.
If constraints cannot be met, return JSON with an error field explaining why.
All strings must be plain text. No newlines in instruction. No emojis. No quotes inside strings.`;

    const userPrompt = `Generate a guided urge protocol with these inputs:

- durationMinutes: ${durationMinutes}
- track: ${track}
- intensity: ${intensity || 'null'}
- context: ${context || 'null'}

SESSION DESIGN REQUIREMENTS
The protocol must follow this structure:
1. Settle (breath/body)
2. Interrupt/Contain (track-specific friction)
3. Replace (track-specific alternative action)
4. Stabilize (mindset/urge-surfing reframe)
5. Next Step (tiny forward action, context-aware)

For ${durationMinutes} minutes, use ${rules.minSteps}–${rules.maxSteps} steps.

TRACK-SPECIFIC REQUIREMENTS
- porn: must include a device/visual trigger friction step (e.g., phone out of room, airplane mode, move to public space), and a "replacement" that is not sexual.
- sex: must include app/contact friction (e.g., close apps, delay message, leave venue, boundary statement), and a replacement that reduces escalation.
- food: must include kitchen/availability friction (e.g., water first, leave kitchen, pre-portioned option), and a replacement involving a planned substitute.

CONTEXT AWARENESS
${context === 'bed' ? '- Context is bed: favor low-light, no-phone steps, grounding, and moving phone away.' : ''}
${context === 'out' ? '- Context is out: favor discreet steps, short walk, change environment.' : ''}
${context === 'home' ? '- Context is home: favor moving rooms, changing lighting, kitchen/device friction.' : ''}
${!context ? '- No specific context provided: use general environment-agnostic steps.' : ''}

INTENSITY ADAPTATION
${intensity && intensity <= 3 ? '- Intensity 1–3: lighter protocol, less containment, more reflection.' : ''}
${intensity && intensity >= 4 && intensity <= 7 ? '- Intensity 4–7: standard containment + replacement.' : ''}
${intensity && intensity >= 8 ? '- Intensity 8–10: stronger containment, "reduce access" immediately; last step may suggest reaching out to a trusted person AFTER the session, not during.' : ''}
${!intensity ? '- No intensity provided: use moderate containment approach.' : ''}

STRICT CONSTRAINTS
- Step count: ${rules.minSteps} to ${rules.maxSteps} steps
- Step duration: each step seconds: 10–60
- Total step seconds target: ${rules.minSeconds}–${rules.maxSeconds}
- Instruction length: max 140 characters, one sentence if possible.
- No shame language. No explicit sexual content. No medical claims.
- Step titles must be 2–5 words, imperative, no punctuation (e.g., "Move phone away", "Cold water reset").
- Do not include lists inside a single step. One action per step.
- The porn/sex/food protocols must not share more than 2 identical step titles or categories in the same order.

OUTPUT JSON STRUCTURE (no extra keys except those below):
{
  "sessionId": "string",
  "durationMinutes": ${durationMinutes},
  "track": "${track}",
  "steps": [
    {
      "id": "string",
      "title": "string",
      "instruction": "string",
      "seconds": number,
      "category": "breath"|"friction"|"replacement"|"mindset"|"body"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const responseText = completion.choices[0].message.content.trim();
    
    // Parse JSON response
    let protocolData;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) || 
                       responseText.match(/```\n?([\s\S]*?)\n?```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : responseText;
      protocolData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse GPT response:', responseText);
      throw new Error('Invalid JSON response from AI');
    }

    // Validate response structure
    if (!protocolData.steps || !Array.isArray(protocolData.steps)) {
      throw new Error('Invalid protocol structure');
    }

    // Validate step count
    if (protocolData.steps.length < rules.minSteps || protocolData.steps.length > rules.maxSteps) {
      throw new Error(`Protocol must have ${rules.minSteps}-${rules.maxSteps} steps, got ${protocolData.steps.length}`);
    }

    // Calculate total duration
    const totalSeconds = protocolData.steps.reduce((sum, step) => sum + (step.seconds || 0), 0);

    // Validate total duration
    if (totalSeconds < rules.minSeconds || totalSeconds > rules.maxSeconds) {
      // Attempt to auto-correct if slightly off
      const target = Math.floor((rules.minSeconds + rules.maxSeconds) / 2);
      const diff = target - totalSeconds;
      const adjustment = Math.floor(diff / protocolData.steps.length);
      
      protocolData.steps = protocolData.steps.map(step => ({
        ...step,
        seconds: Math.max(15, Math.min(60, step.seconds + adjustment))
      }));

      const newTotal = protocolData.steps.reduce((sum, step) => sum + step.seconds, 0);
      
      if (newTotal < rules.minSeconds || newTotal > rules.maxSeconds) {
        throw new Error(`Total duration ${totalSeconds}s outside valid range ${rules.minSeconds}-${rules.maxSeconds}s`);
      }
    }

    // Ensure all steps have required fields
    protocolData.steps = protocolData.steps.map((step, index) => ({
      id: step.id || `step-${index + 1}`,
      title: step.title || 'Untitled Step',
      instruction: step.instruction || '',
      seconds: step.seconds || 30,
      category: step.category || 'general'
    }));

    // Validate instruction length (max 140 characters)
    const invalidInstructions = protocolData.steps.filter(step => 
      step.instruction.length > 140 || 
      step.instruction.includes('\n') ||
      step.title.includes('\n')
    );
    
    if (invalidInstructions.length > 0) {
      console.warn('Some instructions exceed 140 chars or contain newlines, using fallback');
      throw new Error('Instruction validation failed');
    }

    // Build final response
    const protocol = {
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      durationMinutes,
      track,
      intensity: intensity || null,
      context: context || null,
      steps: protocolData.steps,
      totalSeconds: protocolData.steps.reduce((sum, step) => sum + step.seconds, 0)
    };

    return res.status(200).json(protocol);

  } catch (error) {
    console.error('Error generating protocol:', error);
    
    // Fallback: Return hardcoded protocol if AI fails
    const fallbackProtocol = generateFallbackProtocol(durationMinutes, track, intensity, context);
    return res.status(200).json(fallbackProtocol);
  }
}

// Fallback protocol generator
function generateFallbackProtocol(durationMinutes, track, intensity = null, context = null) {
  const trackSteps = {
    porn: {
      2: [
        {
          id: 'step-1',
          title: 'Deep breath check',
          instruction: 'Close your eyes. Take 3 slow breaths, counting to 4 on each inhale and exhale.',
          seconds: 30,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'Phone in another room',
          instruction: 'Put your device in another room right now. Turn on airplane mode if needed.',
          seconds: 25,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Cold water reset',
          instruction: 'Splash cold water on your face or drink a full glass of cold water slowly.',
          seconds: 35,
          category: 'replacement'
        },
        {
          id: 'step-4',
          title: 'Name what you feel',
          instruction: 'Say out loud: "I notice the urge. It will pass." Acknowledge without acting.',
          seconds: 30,
          category: 'mindset'
        }
      ],
      5: [
        {
          id: 'step-1',
          title: 'Box breathing',
          instruction: 'Breathe in 4 counts, hold 4, out 4, hold 4. Do this 4 times.',
          seconds: 50,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'Device out of reach',
          instruction: 'Place phone in another room. Close laptop. Move to a public space if possible.',
          seconds: 30,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Five senses grounding',
          instruction: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste.',
          seconds: 60,
          category: 'body'
        },
        {
          id: 'step-4',
          title: 'Movement break',
          instruction: 'Do 20 jumping jacks or walk around the block. Get your body moving.',
          seconds: 45,
          category: 'replacement'
        },
        {
          id: 'step-5',
          title: 'Urge surfing',
          instruction: 'Notice the urge like a wave. It will crest and pass. You don\'t have to act on it.',
          seconds: 40,
          category: 'mindset'
        },
        {
          id: 'step-6',
          title: 'Next small action',
          instruction: 'Choose one productive thing to do in the next 5 minutes. Start it now.',
          seconds: 35,
          category: 'mindset'
        }
      ]
    },
    sex: {
      2: [
        {
          id: 'step-1',
          title: 'Slow your breathing',
          instruction: 'Place hand on chest. Take 4 slow breaths, feeling your hand rise and fall.',
          seconds: 30,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'Close all apps',
          instruction: 'Close dating apps and messaging right now. Set a 20-minute delay before reopening.',
          seconds: 25,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Change your location',
          instruction: 'Leave the room or venue. Go somewhere with other people or good lighting.',
          seconds: 30,
          category: 'replacement'
        },
        {
          id: 'step-4',
          title: 'Check your real need',
          instruction: 'Ask yourself: "What do I actually need right now? Connection? Validation? Rest?"',
          seconds: 35,
          category: 'mindset'
        }
      ],
      5: [
        {
          id: 'step-1',
          title: 'Body scan breathing',
          instruction: 'Close eyes. Scan your body from head to toe, noticing any tension. Breathe into it.',
          seconds: 50,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'App and contact friction',
          instruction: 'Log out of apps. Delete recent conversations if needed. Put phone in another room.',
          seconds: 35,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Environment shift',
          instruction: 'Move to a public space. Turn on all the lights. Open curtains. Change your setting.',
          seconds: 40,
          category: 'replacement'
        },
        {
          id: 'step-4',
          title: 'Name the real feeling',
          instruction: 'What emotion is driving this? Loneliness? Boredom? Stress? Say it out loud.',
          seconds: 45,
          category: 'mindset'
        },
        {
          id: 'step-5',
          title: 'Healthy alternative',
          instruction: 'Text a friend (not for hookup). Call family. Journal. Choose real connection.',
          seconds: 40,
          category: 'replacement'
        },
        {
          id: 'step-6',
          title: 'Forward momentum',
          instruction: 'Pick one small task: laundry, dishes, shower. Do it now to shift your state.',
          seconds: 50,
          category: 'mindset'
        }
      ]
    },
    food: {
      2: [
        {
          id: 'step-1',
          title: 'Breath before bite',
          instruction: 'Stop. Take 3 deep breaths before you open the fridge or pantry.',
          seconds: 25,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'Water first rule',
          instruction: 'Drink a full glass of water slowly. Set a 2-minute timer before deciding to eat.',
          seconds: 35,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Leave the kitchen',
          instruction: 'Step out of the kitchen completely. Go to another room or outside.',
          seconds: 30,
          category: 'replacement'
        },
        {
          id: 'step-4',
          title: 'Hunger vs emotion check',
          instruction: 'Ask yourself: "Am I physically hungry, or am I trying to feel something else?"',
          seconds: 30,
          category: 'mindset'
        }
      ],
      5: [
        {
          id: 'step-1',
          title: 'Grounding breath',
          instruction: 'Put hand on belly. Take 5 slow belly breaths, feeling your hand move.',
          seconds: 40,
          category: 'breath'
        },
        {
          id: 'step-2',
          title: 'Kitchen friction delay',
          instruction: 'Close the fridge. Step away from pantry. Drink water. Set timer for 5 minutes.',
          seconds: 40,
          category: 'friction'
        },
        {
          id: 'step-3',
          title: 'Physical distance',
          instruction: 'Leave the kitchen entirely. Go outside, to another room, or take a short walk.',
          seconds: 50,
          category: 'replacement'
        },
        {
          id: 'step-4',
          title: 'Body hunger scan',
          instruction: 'Close eyes. Rate physical hunger 1-10. Check stomach, energy, last meal time.',
          seconds: 45,
          category: 'body'
        },
        {
          id: 'step-5',
          title: 'Name the emotion',
          instruction: 'What are you really feeling? Bored, anxious, lonely, tired? Say it out loud.',
          seconds: 40,
          category: 'mindset'
        },
        {
          id: 'step-6',
          title: 'Non-food comfort',
          instruction: 'Choose something that actually addresses the feeling: rest, call someone, stretch.',
          seconds: 45,
          category: 'replacement'
        }
      ]
    }
  };

  const steps = trackSteps[track]?.[durationMinutes] || trackSteps.porn[2];
  
  return {
    sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    durationMinutes,
    track,
    intensity: intensity || null,
    context: context || null,
    steps,
    totalSeconds: steps.reduce((sum, step) => sum + step.seconds, 0)
  };
}
