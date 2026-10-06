import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { jobs } from '../db/schema.js';
import type { JobsRepository, JobsSummary } from './types.js';

export function createPostgresJobsRepository(databaseUrl: string): JobsRepository {
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool });

  return {
    async list(filters) {
      const conditions = [];

      if (filters.query) {
        conditions.push(
          or(
            ilike(jobs.title, `%${filters.query}%`),
            ilike(jobs.company, `%${filters.query}%`),
          ),
        );
      }

      if (filters.status) conditions.push(eq(jobs.status, filters.status));
      if (filters.workplaceType) {
        conditions.push(eq(jobs.workplaceType, filters.workplaceType));
      }
      if (filters.technology) {
        conditions.push(ilike(jobs.technology, `%${filters.technology}%`));
      }
      if (filters.maxAgeDays !== undefined) {
        const publishedSince = new Date();
        publishedSince.setHours(0, 0, 0, 0);
        publishedSince.setDate(publishedSince.getDate() - filters.maxAgeDays);
        conditions.push(gte(jobs.publishedAt, publishedSince));
      }

      const rows = await db
        .select({
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
          workplaceType: jobs.workplaceType,
          technology: jobs.technology,
          url: jobs.url,
          source: jobs.source,
          publishedAt: jobs.publishedAt,
          discoveredAt: jobs.discoveredAt,
          lastSeenAt: jobs.lastSeenAt,
          status: jobs.status,
        })
        .from(jobs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(jobs.publishedAt), desc(jobs.discoveredAt))
        .limit(filters.limit ?? 50);

      return rows;
    },

    async summary() {
      const result = await db.execute(sql`
        select
          count(*)::int as total,
          count(*) filter (where ${jobs.status} = 'new')::int as new,
          count(*) filter (where ${jobs.status} = 'saved')::int as saved,
          count(*) filter (where ${jobs.status} = 'applied')::int as applied,
          count(*) filter (where ${jobs.status} = 'discarded')::int as discarded
        from ${jobs}
      `);

      return (result.rows[0] as unknown as JobsSummary | undefined) ?? {
        total: 0,
        new: 0,
        saved: 0,
        applied: 0,
        discarded: 0,
      };
    },

    async upsert(incomingJobs) {
      if (incomingJobs.length === 0) return 0;

      const now = new Date();
      const values = incomingJobs.map((job) => ({
        ...job,
        workplaceType: job.workplaceType ?? 'not_informed',
        publishedAt: parsePublishedAt(job.publishedAt),
        lastSeenAt: now,
        updatedAt: now,
      }));

      await db
        .insert(jobs)
        .values(values)
        .onConflictDoUpdate({
          target: jobs.id,
          set: {
            title: sql`excluded.title`,
            company: sql`excluded.company`,
            location: sql`excluded.location`,
            workplaceType: sql`excluded.workplace_type`,
            technology: sql`excluded.technology`,
            url: sql`excluded.url`,
            source: sql`excluded.source`,
            publishedAt: sql`excluded.published_at`,
            lastSeenAt: now,
            updatedAt: now,
          },
        });

      return incomingJobs.length;
    },

    async updateStatus(id, status) {
      const now = new Date();
      const [job] = await db
        .update(jobs)
        .set({ status, updatedAt: now })
        .where(eq(jobs.id, id))
        .returning({
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
          workplaceType: jobs.workplaceType,
          technology: jobs.technology,
          url: jobs.url,
          source: jobs.source,
          publishedAt: jobs.publishedAt,
          discoveredAt: jobs.discoveredAt,
          lastSeenAt: jobs.lastSeenAt,
          status: jobs.status,
        });

      return job;
    },

    async close() {
      await pool.end();
    },
  };
}

function parsePublishedAt(value: string | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
