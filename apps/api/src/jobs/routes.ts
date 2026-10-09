import type { FastifyInstance } from 'fastify';
import { jobStatusValues, type IncomingJob, type JobListFilters, type JobStatus } from '@radar-vagas/contracts';
import type { AuthVerifier } from '../auth.js';
import type { JobsRepository, StoredJob } from './types.js';
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

function toPublicJob(job: StoredJob) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    workplaceType: job.workplaceType,
    technology: job.technology,
    url: job.url,
    source: job.source,
    publishedAt: job.publishedAt,
    discoveredAt: job.discoveredAt,
    lastSeenAt: job.lastSeenAt,
  };
}

export async function registerJobRoutes(app: FastifyInstance, options: JobRoutesOptions) {
  const guards = createJobGuards(app, options);

  app.get('/auth/me', { preHandler: [guards.requireAuthenticated, guards.requireRole] }, async (request) => {
    const userId = request.dashboardUserId!;
    return { userId, role: request.dashboardRole };
  });

  app.get(
    '/jobs',
    {
      preHandler: [guards.requireAuthenticated, guards.requireRole],
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
          403: {
            type: 'object',
            additionalProperties: false,
            required: ['statusCode', 'error', 'message'],
            properties: {
              statusCode: { type: 'integer' },
              error: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const filters = request.query as JobListFilters;
      if (filters.status && request.dashboardRole !== 'admin') {
        return reply.code(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Only the dashboard administrator can filter by job status.',
        });
      }
      const items = await options.repository.list(filters);
      return { items: request.dashboardRole === 'admin' ? items : items.map(toPublicJob) };
    },
  );

  app.patch(
    '/jobs/:id/status',
    {
      preHandler: [guards.requireAuthenticated, guards.requireRole, guards.requireAdmin],
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
      preHandler: [guards.requireAuthenticated, guards.requireRole],
      schema: {
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['total'],
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
    async (request) => {
      const summary = await options.repository.summary();
      return request.dashboardRole === 'admin' ? summary : { total: summary.total };
    },
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
                  url: { type: 'string', format: 'uri', pattern: '^https?://' },
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
