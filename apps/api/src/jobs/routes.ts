import type { FastifyInstance } from 'fastify';
import { jobStatusValues, type IncomingJob, type JobListFilters, type JobStatus } from '@radar-vagas/contracts';
import type { AuthVerifier } from '../auth.js';
import type { JobsRepository } from './types.js';
import type { RolesRepository } from '../roles.js';
import { createJobGuards } from './guards.js';

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
    'technology',
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
  const guards = createJobGuards(app, options);

  app.get('/auth/me', { preHandler: [guards.requireAuthenticated, guards.requireRolesConfigured] }, async (request) => {
    const userId = request.dashboardUserId!;
    return { userId, role: await options.rolesRepository!.getRole(userId) };
  });

  app.get(
    '/jobs',
    {
      preHandler: guards.requireAuthenticated,
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
    async (request) => {
      const filters = request.query as JobListFilters;
      const items = await options.repository.list(filters);
      return { items };
    },
  );

  app.patch(
    '/jobs/:id/status',
    {
      preHandler: [guards.requireAuthenticated, guards.requireAdmin],
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
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: JobStatus };
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
      preHandler: guards.requireAuthenticated,
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
    async () => options.repository.summary(),
  );

  app.post(
    '/internal/jobs',
    {
      preHandler: guards.requireIngestionToken,
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
    async (request) => {
      const { jobs } = request.body as { jobs: IncomingJob[] };
      const processed = await options.repository.upsert(jobs);
      return { processed };
    },
  );
}
