import { createClient } from '@supabase/supabase-js';

export interface AuthVerifier {
  verify(authorization?: string): Promise<string | null>;
}

export class AuthProviderUnavailableError extends Error {
  constructor() {
    super('Supabase Auth is unavailable.');
  }
}

export function createSupabaseAuthVerifier(url?: string, key?: string): AuthVerifier | undefined {
  if (!url || !key) return undefined;

  const authClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return {
    async verify(authorization) {
      const token = authorization?.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length)
        : undefined;
      if (!token) return null;

      let result;
      try {
        result = await authClient.auth.getUser(token);
      } catch {
        throw new AuthProviderUnavailableError();
      }
      const { data, error } = result;
      if (error && (error.status === 0 || (error.status !== undefined && error.status >= 500))) {
        throw new AuthProviderUnavailableError();
      }
      return error ? null : data.user?.id ?? null;
    },
  };
}
