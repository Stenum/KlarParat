import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('8787'),
  ADMIN_PIN: z.string().min(4),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_TTS_MODEL: z.string().default('gpt-4o-mini-tts'),
  OPENAI_TTS_VOICE: z.string().default('alloy'),
  RATE_LIMIT_POINTS: z.string().default('30'),
  RATE_LIMIT_DURATION: z.string().default('60'),
  DATABASE_URL: z.string().default('file:./prisma/data.db'),
});

const env = envSchema.parse(process.env);

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

export const ENV = {
  ...env,
  PORT: Number(env.PORT),
  RATE_LIMIT_POINTS: Number(env.RATE_LIMIT_POINTS),
  RATE_LIMIT_DURATION: Number(env.RATE_LIMIT_DURATION),
};
