import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import OpenAI from 'openai';
import { ENV } from '../env.js';

type Clip = {
  id: string;
  createdAt: number;
  buffer: Buffer;
  mimeType: string;
};

const CACHE_TTL_MS = 1000 * 60 * 10;
const clips = new Map<string, Clip>();

const openai = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });

export async function synthesizeSpeech(text: string) {
  const response = await openai.audio.speech.create({
    model: ENV.OPENAI_TTS_MODEL,
    voice: ENV.OPENAI_TTS_VOICE,
    input: text,
    format: 'mp3',
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const id = randomUUID();
  clips.set(id, { id, createdAt: Date.now(), buffer, mimeType: 'audio/mpeg' });
  prune();
  return { clipId: id, urlPath: `/api/tts/${id}` };
}

export function getClip(id: string) {
  const clip = clips.get(id);
  if (!clip) return null;
  return clip;
}

function prune() {
  const now = Date.now();
  for (const [id, clip] of clips) {
    if (now - clip.createdAt > CACHE_TTL_MS) {
      clips.delete(id);
    }
  }
}

export function asStream(clip: Clip) {
  return Readable.from(clip.buffer);
}
