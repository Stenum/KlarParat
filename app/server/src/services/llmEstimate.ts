import OpenAI from 'openai';
import { z } from 'zod';
import { ENV } from '../env.js';

const SYSTEM_PROMPT = `You are a planner helping parents estimate realistic per-task durations for a morning routine for small children in Denmark. 
Respond as strict JSON only, no prose. Prefer conservative, achievable durations. 
Ensure the sum of task durations fits within the total available window; if it cannot, proportionally scale down low-priority tasks but never below 30 seconds.`;

const responseSchema = z.object({
  estimates: z.array(z.object({
    taskId: z.string(),
    estimatedSeconds: z.number().int().min(30).max(3600),
  })),
  notes: z.string().optional(),
});

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export interface EstimatePayload {
  routineTitle: string;
  window: { from: string; to: string };
  children: { name: string; ageYears: number | null }[];
  tasks: { id: string; title: string; internalDescription?: string | null }[];
  priorEstimatesSeconds: Record<string, number> | null;
  activationOverrides: unknown;
}

export async function estimateDurations(payload: EstimatePayload) {
  const response = await openai.responses.create({
    model: ENV.OPENAI_TEXT_MODEL,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
    response_format: { type: 'json_object' },
  });
  const message = response.output?.[0];
  if (!message || message.type !== 'message') {
    throw new Error('Estimate generation failed');
  }
  const jsonPart = message.content?.find((part) => part.type === 'output_text');
  if (!jsonPart || !jsonPart.text) {
    throw new Error('Estimate output missing');
  }
  const parsed = responseSchema.safeParse(JSON.parse(jsonPart.text));
  if (!parsed.success) {
    throw new Error('Estimate response invalid');
  }
  return parsed.data;
}
