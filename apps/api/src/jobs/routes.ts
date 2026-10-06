import type { FastifyInstance } from 'fastify';
import { AuthProviderUnavailableError, type AuthVerifier } from '../auth.js';
import { jobStatusValues } from '../db/schema.js';
import type { IncomingJob, JobListFilters, JobsRepository } from './types.js';
import type { RolesRepository } from '../roles.js';

interface JobRoutesOptions {
  repository: JobsRepository;
  ingestionToken?: string;
  authVerifier?: AuthVerifier;
  rolesRepository?: RolesRepository;
}

const jobSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'title',
    'company',
    'location',
    'workplaceType',
    'url',
    'source',
    'publishedAt',
    'discoveredAt',
    'lastSeenAt',
    'status',
  ],
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    company: { type: 'string' },
    location: { type: 'string' },
    workplaceType: { type: 'string' },
    technology: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    url: { type: 'string' },
    source: { type: 'string' },
    publishedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
    discoveredAt: { type: 'string', format: 'date-time' },
    lastSeenAt: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: jobStatusValues },
  },
} as const;

export async function registerJobRoutes(app: FastifyInstance, options: JobRoutesOptions) {
  app.get('/auth/me', async (request, reply) => {
    if (!options.rolesRepository) {
      return reply.code(503).send({ message: 'Dashboard roles are not configured.' });
    }
    const userId = await authenticate(request.headers.authorization, reply, options.authVerifier);
    if (!userId) return;

    return { userId, role: await options.rolesRepository.getRole(userId) };
  });

  app.get(
    '/jobs',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            query: { type: 'string', minLength: 1, maxLength: 100 },
            status: { type: 'string', enum: jobStatusValues },
            workplaceType: { type: 'string', minLength: 1, maxLength: 50 },
            technology: { type: 'string', minLength: 1, maxLength: 50 },
            maxAgeDays: { type: 'integer', minimum: 0, maximum: 365 },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: { type: 'array', items: jobSchema },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = await authenticate(request.headers.authorization, reply, options.authVerifier);
      if (!userId) return;
      const filters = request.query as JobListFilters;
      const items = await options.repository.list(filters);
      return { items };
    },
  );

  app.patch(
    '/jobs/:id/status',
    {
      schema: {
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['id'],
          properties: { id: { type: 'string', minLength: 1 } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: { status: { type: 'string', enum: jobStatusValues } },
        },
      },
    },
    async (request, reply) => {
      if (!options.authVerifier || !options.rolesRepository) {
        return reply.code(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'Dashboard roles are not configured.',
        });
      }

      const userId = await authenticate(request.headers.authorization, reply, options.authVerifier);
      if (!userId) return;

      if (await options.rolesRepository.getRole(userId) !== 'admin') {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the dashboard administrator can update job statuses.',
        });
      }

      const { id } = request.params as { id: string };
      const { status } = request.body as { status: (typeof jobStatusValues)[number] };
      const job = await options.repository.updateStatus(id, status);

      if (!job) {
        return reply.code(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Job not found.',
        });
      }

      return job;
    },
  );

  app.get(
    '/jobs/summary',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['total', 'new', 'saved', 'applied', 'discarded'],
            properties: {
              total: { type: 'integer' },
              new: { type: 'integer' },
              saved: { type: 'integer' },
              applied: { type: 'integer' },
              discarded: { type: 'integer' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = await authenticate(request.headers.authorization, reply, options.authVerifier);
      if (!userId) return;
      return options.repository.summary();
    },
  );

  app.post(
    '/internal/jobs',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['jobs'],
          properties: {
            jobs: {
              type: 'array',
              maxItems: 100,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'title', 'company', 'location', 'url', 'source'],
                properties: {
                  id: { type: 'string', minLength: 1 },
                  title: { type: 'string', minLength: 1 },
                  company: { type: 'string', minLength: 1 },
                  location: { type: 'string', minLength: 1 },
                  workplaceType: { type: 'string', minLength: 1 },
                  technology: { type: 'string', minLength: 1, maxLength: 50 },
                  url: { type: 'string', format: 'uri' },
                  source: { type: 'string', minLength: 1 },
                  publishedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!options.ingestionToken) {
        return reply.code(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: 'The ingestion endpoint is not configured.',
        });
      }

      if (request.headers.authorization !== `Bearer ${options.ingestionToken}`) {
        return reply.code(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid ingestion token.',
        });
      }

      const { jobs } = request.body as { jobs: IncomingJob[] };
      const processed = await options.repository.upsert(jobs);
      return { processed };
    },
  );
}

async function authenticate(
  authorization: string | undefined,
  reply: import('fastify').FastifyReply,
  verifier: AuthVerifier | undefined,
): Promise<string | undefined> {
  if (!verifier) {
    reply.code(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Dashboard authentication is not configured.',
    });
    return undefined;
  }

  let userId: string | null;
  try {
    userId = await verifier.verify(authorization);
  } catch (error) {
    if (!(error instanceof AuthProviderUnavailableError)) throw error;
    reply.code(503).send({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Supabase Auth is temporarily unavailable.',
    });
    return undefined;
  }
  if (!userId) {
    reply.code(401).send({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Sign in to access the dashboard.',
    });
    return undefined;
  }

  return userId;
}
