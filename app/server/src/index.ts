import { ENV } from './env.js';
import { createServer } from './app.js';

const fastify = await createServer();

fastify.listen({ port: ENV.PORT, host: '0.0.0.0' }).catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
