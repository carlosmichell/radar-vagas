import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AuthProviderUnavailableError, type AuthVerifier } from '../auth.js';
import type { RolesRepository } from '../roles.js';

declare module 'fastify' {
  interface FastifyRequest {
    dashboardUserId: string | null;
  }
}

interface GuardOptions {
  authVerifier?: AuthVerifier;
  rolesRepository?: RolesRepository;
  ingestionToken?: string;
}

function sendError(reply: FastifyReply, statusCode: number, error: string, message: string) {
  return reply.code(statusCode).send({ statusCode, error, message });
}

export function createJobGuards(app: FastifyInstance, options: GuardOptions) {
  app.decorateRequest('dashboardUserId', null);

  async function requireAuthenticated(request: FastifyRequest, reply: FastifyReply) {
    if (!options.authVerifier) {
      return sendError(reply, 503, 'Service Unavailable', 'Dashboard authentication is not configured.');
    }

    let userId: string | null;
    try {
      userId = await options.authVerifier.verify(request.headers.authorization);
    } catch (error) {
      if (!(error instanceof AuthProviderUnavailableError)) throw error;
      return sendError(reply, 503, 'Service Unavailable', 'Supabase Auth is temporarily unavailable.');
    }

    if (!userId) {
      return sendError(reply, 401, 'Unauthorized', 'Sign in to access the dashboard.');
    }
    request.dashboardUserId = userId;
  }

  async function requireRolesConfigured(_request: FastifyRequest, reply: FastifyReply) {
    if (!options.rolesRepository) {
      return sendError(reply, 503, 'Service Unavailable', 'Dashboard roles are not configured.');
    }
  }

  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    if (!options.rolesRepository) {
      return sendError(reply, 503, 'Service Unavailable', 'Dashboard roles are not configured.');
    }
    if (await options.rolesRepository.getRole(request.dashboardUserId!) !== 'admin') {
      return sendError(reply, 403, 'Forbidden', 'Only the dashboard administrator can update job statuses.');
    }
  }

  async function requireIngestionToken(request: FastifyRequest, reply: FastifyReply) {
    if (!options.ingestionToken) {
      return sendError(reply, 503, 'Service Unavailable', 'The ingestion endpoint is not configured.');
    }
    if (request.headers.authorization !== `Bearer ${options.ingestionToken}`) {
      return sendError(reply, 401, 'Unauthorized', 'Invalid ingestion token.');
    }
  }

  return { requireAuthenticated, requireRolesConfigured, requireAdmin, requireIngestionToken };
}
