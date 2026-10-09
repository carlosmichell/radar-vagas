import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { AuthVerifier } from './auth.js';
import { registerJobRoutes } from './jobs/routes.js';
import type { JobsRepository } from './jobs/types.js';
import type { RolesRepository } from './roles.js';

interface AppDependencies {
  repository?: JobsRepository;
  ingestionToken?: string;
  authVerifier?: AuthVerifier;
  rolesRepository?: RolesRepository;
}

export function buildApp(options: FastifyServerOptions = {}, dependencies: AppDependencies = {}) {
  const app = Fastify(options);

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    return payload;
  });

  app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  });

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['status'],
            properties: {
              status: { type: 'string', const: 'ok' },
            },
          },
        },
      },
    },
    async () => ({ status: 'ok' }),
  );

  if (dependencies.repository) {
    app.register(registerJobRoutes, {
      repository: dependencies.repository,
      ingestionToken: dependencies.ingestionToken,
      authVerifier: dependencies.authVerifier,
      rolesRepository: dependencies.rolesRepository,
    });
  }

  return app;
}
