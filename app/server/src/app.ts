import Fastify, { FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { ENV } from './env.js';
import { logger } from './logger.js';
import { adminRoutes } from './routes/admin.js';
import { routinesRoutes } from './routes/routines.js';
import { sessionsRoutes } from './routes/sessions.js';
import { ttsRoutes } from './routes/tts.js';
import { toHttpError } from './util/errors.js';

type CreateServerOptions = FastifyServerOptions & {
  disableRateLimit?: boolean;
  disableDocs?: boolean;
};

export async function createServer(options: CreateServerOptions = {}) {
  const { logger: overrideLogger, disableRateLimit, disableDocs, ...rest } = options;
  const fastify = Fastify({
    ...(rest as FastifyServerOptions),
    logger: overrideLogger ?? logger,
  });

  await fastify.register(cors, {
    origin: ENV.NODE_ENV === 'development' ? true : [/localhost/, /127\.0\.0\.1/],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  if (!disableRateLimit) {
    await fastify.register(rateLimit, {
      max: ENV.RATE_LIMIT_POINTS,
      timeWindow: `${ENV.RATE_LIMIT_DURATION} seconds`,
      skipOnError: true,
    });
  }

  if (!disableDocs) {
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'KlarParat API',
          version: '0.1.0',
        },
      },
    });

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
    });
  }

  await fastify.register(async (instance) => {
    await instance.register(adminRoutes);
    await instance.register(routinesRoutes);
    await instance.register(sessionsRoutes);
    await instance.register(ttsRoutes);
  });

  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error({ err: error }, 'Unhandled error');
    const mapped = toHttpError(error);
    reply.status(mapped.status).send(mapped.body);
  });

  return fastify;
}
