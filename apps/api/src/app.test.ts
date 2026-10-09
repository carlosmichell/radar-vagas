import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { buildApp } from './app.js';
import { AuthProviderUnavailableError, createSupabaseAuthVerifier } from './auth.js';
import type { JobsRepository, StoredJob } from './jobs/types.js';

const publishedAt = new Date('2026-10-02T09:00:00.000Z');

const exampleJob: StoredJob = {
  id: 'gupy:1',
  title: 'Frontend Developer',
  company: 'Example Company',
  location: 'Remote',
  workplaceType: 'remote',
  technology: 'React',
  url: 'https://example.com/jobs/1',
  source: 'gupy',
  publishedAt,
  discoveredAt: new Date('2026-10-02T10:00:00.000Z'),
  lastSeenAt: new Date('2026-10-02T10:00:00.000Z'),
  status: 'new',
};

test('GET /health returns the API status', async (context) => {
  const app = buildApp();
  context.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/health',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('GET /auth/me reports an unavailable auth provider as 503', async (context) => {
  const app = buildApp({}, {
    repository: { list: async () => [], summary: async () => ({ total: 0, new: 0, saved: 0, applied: 0, discarded: 0 }), upsert: async () => 0, updateStatus: async () => undefined },
    authVerifier: { verify: async () => { throw new AuthProviderUnavailableError(); } },
    rolesRepository: { getRole: async () => 'viewer' },
  });
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: 'Bearer test-token' } });
  assert.equal(response.statusCode, 503);
});

test('job routes fail closed when roles are not configured', async (context) => {
  const app = buildApp({}, {
    repository: { list: async () => [], summary: async () => ({ total: 0, new: 0, saved: 0, applied: 0, discarded: 0 }), upsert: async () => 0, updateStatus: async () => undefined },
    authVerifier: { verify: async () => 'some-user-id' },
  });
  context.after(() => app.close());

  const response = await app.inject({ method: 'GET', url: '/jobs', headers: { authorization: 'Bearer valid-session' } });
  assert.equal(response.statusCode, 503);
});

test('Supabase verifier resolves the user from a bearer token', async (context) => {
  const server = createServer((request, response) => {
    const allowed = request.url === '/auth/v1/user' && request.headers.authorization === 'Bearer valid-token';
    response.writeHead(allowed ? 200 : 401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(allowed ? { id: 'admin-user-id' } : { message: 'Invalid token' }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const verifier = createSupabaseAuthVerifier(`http://127.0.0.1:${address.port}`, 'test-key');
  assert.ok(verifier);
  assert.equal(await verifier.verify('Bearer valid-token'), 'admin-user-id');
  assert.equal(await verifier.verify('Bearer invalid-token'), null);
});

test('job routes list, summarize, and authenticate ingestion', async (context) => {
  let ingestedJobCount = 0;
  let updatedStatus: StoredJob['status'] | undefined;
  let listedMaxAgeDays: number | undefined;
  const repository: JobsRepository = {
    async list(filters) {
      listedMaxAgeDays = filters.maxAgeDays;
      return [exampleJob];
    },
    async summary() {
      return {
        total: 1,
        new: 1,
        saved: 0,
        applied: 0,
        discarded: 0,
      };
    },
    async upsert(incomingJobs) {
      ingestedJobCount = incomingJobs.length;
      return incomingJobs.length;
    },
    async updateStatus(id, status) {
      if (id !== exampleJob.id) return undefined;
      updatedStatus = status;
      return { ...exampleJob, status };
    },
  };

  const app = buildApp({}, {
    repository,
    ingestionToken: 'test-token',
    authVerifier: {
      verify: async (authorization) => {
        if (authorization === 'Bearer admin-session') return 'admin-user-id';
        if (authorization === 'Bearer viewer-session') return 'viewer-user-id';
        return null;
      },
    },
    rolesRepository: { getRole: async (userId) => userId === 'admin-user-id' ? 'admin' : 'viewer' },
  });
  context.after(() => app.close());

  const jobsResponse = await app.inject({
    method: 'GET',
    url: '/jobs',
    headers: { authorization: 'Bearer admin-session' },
  });
  assert.equal(jobsResponse.statusCode, 200);
  assert.equal(jobsResponse.json().items[0].id, exampleJob.id);
  assert.equal(jobsResponse.json().items[0].status, 'new');

  const viewerJobsResponse = await app.inject({
    method: 'GET',
    url: '/jobs',
    headers: { authorization: 'Bearer viewer-session' },
  });
  assert.equal(viewerJobsResponse.statusCode, 200);
  assert.equal('status' in viewerJobsResponse.json().items[0], false);

  const viewerStatusFilterResponse = await app.inject({
    method: 'GET',
    url: '/jobs?status=applied',
    headers: { authorization: 'Bearer viewer-session' },
  });
  assert.equal(viewerStatusFilterResponse.statusCode, 403);

  const adminStatusFilterResponse = await app.inject({
    method: 'GET',
    url: '/jobs?status=applied',
    headers: { authorization: 'Bearer admin-session' },
  });
  assert.equal(adminStatusFilterResponse.statusCode, 200);

  const anonymousJobsResponse = await app.inject({ method: 'GET', url: '/jobs' });
  assert.equal(anonymousJobsResponse.statusCode, 401);

  const invalidSessionResponse = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Bearer invalid-session' },
  });
  assert.equal(invalidSessionResponse.statusCode, 401);

  const ingestionTokenOnDashboardResponse = await app.inject({
    method: 'GET',
    url: '/jobs/summary',
    headers: { authorization: 'Bearer test-token' },
  });
  assert.equal(ingestionTokenOnDashboardResponse.statusCode, 401);

  const filteredJobsResponse = await app.inject({
    method: 'GET',
    url: '/jobs?maxAgeDays=7',
    headers: { authorization: 'Bearer admin-session' },
  });
  assert.equal(filteredJobsResponse.statusCode, 200);
  assert.equal(listedMaxAgeDays, 7);

  const summaryResponse = await app.inject({
    method: 'GET',
    url: '/jobs/summary',
    headers: { authorization: 'Bearer admin-session' },
  });
  assert.deepEqual(summaryResponse.json(), {
    total: 1,
    new: 1,
    saved: 0,
    applied: 0,
    discarded: 0,
  });

  const viewerSummaryResponse = await app.inject({
    method: 'GET',
    url: '/jobs/summary',
    headers: { authorization: 'Bearer viewer-session' },
  });
  assert.equal(viewerSummaryResponse.statusCode, 200);
  assert.deepEqual(viewerSummaryResponse.json(), { total: 1 });

  const unauthorizedResponse = await app.inject({
    method: 'POST',
    url: '/internal/jobs',
    payload: { jobs: [] },
  });
  assert.equal(unauthorizedResponse.statusCode, 401);

  const dashboardTokenOnIngestionResponse = await app.inject({
    method: 'POST',
    url: '/internal/jobs',
    headers: { authorization: 'Bearer admin-session' },
    payload: { jobs: [] },
  });
  assert.equal(dashboardTokenOnIngestionResponse.statusCode, 401);

  const ingestionResponse = await app.inject({
    method: 'POST',
    url: '/internal/jobs',
    headers: { authorization: 'Bearer test-token' },
    payload: {
      jobs: [
        {
          id: exampleJob.id,
          title: exampleJob.title,
          company: exampleJob.company,
          location: exampleJob.location,
          workplaceType: exampleJob.workplaceType,
          technology: exampleJob.technology ?? undefined,
          url: exampleJob.url,
          source: exampleJob.source,
          publishedAt: publishedAt.toISOString(),
        },
      ],
    },
  });

  assert.equal(ingestionResponse.statusCode, 200);
  assert.deepEqual(ingestionResponse.json(), { processed: 1 });
  assert.equal(ingestedJobCount, 1);

  const unsafeUrlResponse = await app.inject({
    method: 'POST',
    url: '/internal/jobs',
    headers: { authorization: 'Bearer test-token' },
    payload: {
      jobs: [{
        id: exampleJob.id,
        title: exampleJob.title,
        company: exampleJob.company,
        location: exampleJob.location,
        url: 'javascript:alert(1)',
        source: exampleJob.source,
      }],
    },
  });
  assert.equal(unsafeUrlResponse.statusCode, 400);
  assert.equal(ingestedJobCount, 1);

  const statusResponse = await app.inject({
    method: 'PATCH',
    url: `/jobs/${exampleJob.id}/status`,
    headers: { authorization: 'Bearer admin-session' },
    payload: { status: 'saved' },
  });
  assert.equal(statusResponse.statusCode, 200);
  assert.equal(statusResponse.json().status, 'saved');
  assert.equal(updatedStatus, 'saved');

  const viewerResponse = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: 'Bearer viewer-session' },
  });
  assert.equal(viewerResponse.statusCode, 200);
  assert.deepEqual(viewerResponse.json(), { userId: 'viewer-user-id', role: 'viewer' });

  const forbiddenResponse = await app.inject({
    method: 'PATCH',
    url: `/jobs/${exampleJob.id}/status`,
    headers: { authorization: 'Bearer viewer-session' },
    payload: { status: 'applied' },
  });
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(updatedStatus, 'saved');

  const unauthenticatedStatusResponse = await app.inject({
    method: 'PATCH',
    url: `/jobs/${exampleJob.id}/status`,
    payload: { status: 'applied' },
  });
  assert.equal(unauthenticatedStatusResponse.statusCode, 401);
  assert.equal(updatedStatus, 'saved');
});
