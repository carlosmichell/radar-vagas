import { Pool } from 'pg';

export type AppRole = 'admin' | 'viewer';

export interface RolesRepository {
  getRole(userId: string): Promise<AppRole>;
  close?(): Promise<void>;
}

export function createPostgresRolesRepository(databaseUrl: string): RolesRepository {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });

  return {
    async getRole(userId) {
      const result = await pool.query<{ role: AppRole }>(
        'select role from public.user_roles where user_id = $1',
        [userId],
      );
      return result.rows[0]?.role === 'admin' ? 'admin' : 'viewer';
    },
    async close() {
      await pool.end();
    },
  };
}
