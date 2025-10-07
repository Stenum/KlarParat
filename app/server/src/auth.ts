import { FastifyReply, FastifyRequest } from 'fastify';
import { ENV } from './env.js';

export function requireAdminPin(request: FastifyRequest, reply: FastifyReply, done: () => void) {
  const header = request.headers['x-admin-pin'];
  if (header !== ENV.ADMIN_PIN) {
    reply.status(401).send({ error: 'Unauthorized' });
    return;
  }
  done();
}
