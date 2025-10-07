import { FastifyInstance } from 'fastify';
import { asStream, getClip } from '../services/tts.js';

export async function ttsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/tts/:clipId', async (request, reply) => {
    const { clipId } = request.params as { clipId: string };
    const clip = getClip(clipId);
    if (!clip) {
      reply.code(404).send({ error: 'Not found' });
      return;
    }
    reply.header('Content-Type', clip.mimeType);
    reply.send(asStream(clip));
  });
}
