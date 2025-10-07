import OpenAI from 'openai';
import { ENV } from '../env.js';

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a kind Danish morning coach for small children. 
Output ONE short sentence (≤ 12 words). No emojis. No exclamation overload. Speak to the child by first name. 
Be specific about what they just did or should do next. 
If nudging, be gentle and encouraging, not scolding. 
Reply as plain text only.`;

export type SpeechKind = 'taskComplete' | 'nudge' | 'allDone';

export interface SpeechContext {
  kind: SpeechKind;
  child: { name: string; ageYears: number | null };
  routine: {
    title: string;
    window: { from: string; to: string };
    elapsedSeconds: number;
    remainingSeconds: number;
  };
  taskContext: {
    current: { id: string; title: string; internalDescription?: string | null } | null;
    next: { id: string; title: string } | null;
  };
  pace: {
    plannedForCurrent: number | null;
    actualForCurrent: number | null;
    onTrack: boolean;
  };
  session: {
    tasksDone: number;
    tasksTotal: number;
    userEditedAtActivation: boolean;
  };
  reward: string | null;
}

export async function generateSpeech(context: SpeechContext): Promise<string> {
  const completion = await openai.responses.create({
    model: ENV.OPENAI_TEXT_MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(context) },
    ],
  });
  const message = completion.output?.[0];
  if (!message || message.type !== 'message') {
    throw new Error('Speech generation failed');
  }
  const textPart = message.content?.find((part) => part.type === 'output_text');
  if (!textPart || !textPart.text) {
    throw new Error('Speech output missing');
  }
  return textPart.text.trim();
}
