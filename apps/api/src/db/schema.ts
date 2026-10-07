import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { jobStatusValues } from '@radar-vagas/contracts';

export const jobStatus = pgEnum('job_status', jobStatusValues);
export const userRole = pgEnum('radar_user_role', ['viewer', 'admin']);

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').primaryKey(),
  role: userRole('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    company: text('company').notNull(),
    location: text('location').notNull(),
    workplaceType: text('workplace_type').notNull().default('not_informed'),
    technology: text('technology'),
    url: text('url').notNull(),
    source: text('source').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    discoveredAt: timestamp('discovered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: jobStatus('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('jobs_published_at_idx').on(table.publishedAt),
    index('jobs_status_idx').on(table.status),
    index('jobs_workplace_type_idx').on(table.workplaceType),
    index('jobs_technology_idx').on(table.technology),
  ],
).enableRLS();
