import type { JobDto, JobListFilters, JobStatus, JobsSummary } from '@radar-vagas/contracts'
import { authClient } from './auth'

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { data, error } = await authClient.auth.getSession()
  if (error) throw new Error(`Supabase Auth não conseguiu recuperar a sessão: ${error.message}`)
  const token = data.session?.access_token
  if (!token) throw new Error('A sessão expirou. Entre novamente para continuar.')

  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`A API recusou a requisição (HTTP ${response.status}).`)
  return response.json() as Promise<T>
}

export function getAccount() {
  return apiRequest<{ userId: string; role: 'admin' | 'viewer' }>('/auth/me')
}

export function getSummary() {
  return apiRequest<JobsSummary>('/jobs/summary')
}

export function getJobs(filters: Pick<JobListFilters, 'query' | 'workplaceType' | 'maxAgeDays'>) {
  const parameters = new URLSearchParams()
  if (filters.query) parameters.set('query', filters.query)
  if (filters.workplaceType) parameters.set('workplaceType', filters.workplaceType)
  if (filters.maxAgeDays !== undefined) parameters.set('maxAgeDays', String(filters.maxAgeDays))
  const suffix = parameters.size ? `?${parameters}` : ''
  return apiRequest<{ items: JobDto[] }>(`/jobs${suffix}`)
}

export function updateJobStatus(id: string, status: JobStatus) {
  return apiRequest<JobDto>(`/jobs/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}
