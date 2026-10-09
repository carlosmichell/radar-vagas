import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { jobStatusValues, type JobStatus, type JobsSummary, type VisibleJobDto, type VisibleJobsSummary } from '@radar-vagas/contracts'
import { getAccount, getJobs, getSummary, updateJobStatus } from './apiClient'
import { authClient } from './auth'

const statusLabels: Record<JobStatus, string> = {
  new: 'Nova',
  saved: 'Salva',
  applied: 'Candidatado',
  discarded: 'Descartada',
}

const workplaceLabels: Record<string, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  on_site: 'Presencial',
  not_informed: 'Não informado',
}

function summaryCards(summary: JobsSummary) {
  return [
    { label: 'vagas novas', value: summary.new },
    { label: 'salvas', value: summary.saved },
    { label: 'candidaturas', value: summary.applied },
    { label: 'das vagas viraram candidaturas', value: `${summary.total ? Math.round((summary.applied / summary.total) * 100) : 0}%` },
  ]
}

function formatPublishedAge(publishedAt: string | null) {
  if (!publishedAt) return 'Data não informada'
  const publishedDate = new Date(publishedAt)
  if (Number.isNaN(publishedDate.getTime())) return 'Data não informada'
  const days = Math.max(0, Math.floor((Date.now() - publishedDate.getTime()) / 86_400_000))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Há 1 dia'
  return `Há ${days} dias`
}

function formatPublishedDate(publishedAt: string | null) {
  if (!publishedAt) return 'Não informada'
  const publishedDate = new Date(publishedAt)
  if (Number.isNaN(publishedDate.getTime())) return 'Não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(publishedDate)
}

function formatWorkplaceType(workplaceType: string) {
  return workplaceLabels[workplaceType] ?? workplaceType
}

function safeJobUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function SelectChevron() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 text-[#a8a29a]" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 12 12">
      <path d="m2.5 4.5 3.5 3 3.5-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function App() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<VisibleJobsSummary>({ total: 0 })
  const [jobs, setJobs] = useState<VisibleJobDto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [workplaceType, setWorkplaceType] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState('')
  const [accountRole, setAccountRole] = useState<'loading' | 'admin' | 'viewer' | 'error'>('loading')
  const [accountError, setAccountError] = useState<string | null>(null)
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  async function loadSummary() {
    setSummary(await getSummary())
  }

  useEffect(() => {
    void loadSummary().catch(() => undefined)
    void getAccount()
      .then((account) => {
        setAccountRole(account.role)
      })
      .catch((cause: unknown) => {
        setAccountRole('error')
        setAccountError(cause instanceof Error ? cause.message : 'Não foi possível obter um token de acesso.')
      })
  }, [])

  useEffect(() => {
    let active = true
    async function loadJobs() {
      try {
        const data = await getJobs({
          query,
          workplaceType,
          maxAgeDays: maxAgeDays ? Number(maxAgeDays) : undefined,
        })
        if (active) setJobs(data.items)
      } catch {
        if (active) {
          setJobs([])
          setError('Não foi possível carregar as vagas.')
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    const timeout = window.setTimeout(() => void loadJobs(), query ? 250 : 0)
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [query, workplaceType, maxAgeDays])

  async function updateStatus(id: string, status: JobStatus) {
    if (accountRole !== 'admin') return
    setUpdatingJobId(id)
    setError(null)
    try {
      const updatedJob = await updateJobStatus(id, status)
      setJobs((currentJobs) => currentJobs.map((job) => (job.id === id ? updatedJob : job)))
      await loadSummary()
    } catch {
      setError('Não foi possível atualizar o status. Entre na sua conta e tente novamente.')
    } finally {
      setUpdatingJobId(null)
    }
  }

  async function signOut() {
    try {
      const { error: signOutError } = await authClient.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
      navigate('/login', { replace: true })
    } catch {
      setAccountError('Não foi possível sair. Tente novamente.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0d] py-4 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2926] px-4 pb-4">
          <h1 className="text-lg font-bold">Radar de Vagas</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#a8a29a]">
              {accountRole === 'loading' && 'Verificando acesso...'}
              {accountRole === 'admin' && 'Admin'}
              {accountRole === 'viewer' && 'Visualização'}
              {accountRole === 'error' && 'Não foi possível validar o acesso'}
            </span>
            <button className="rounded text-xs text-[#a8a29a] hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-300" onClick={() => void signOut()} type="button">Sair</button>
          </div>
        </header>
        <main className="px-4">
          <section className="mt-6">
            <h2 className="text-lg font-semibold">Últimas vagas encontradas</h2>
            <p className="mt-1 text-sm text-[#a8a29a]">Resultados coletados diariamente na Gupy.</p>
          </section>
          <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(accountRole === 'admin' && 'applied' in summary ? summaryCards(summary) : [{ label: 'vagas encontradas', value: summary.total }]).map(({ label, value }) => (
              <div className="flex flex-col rounded-md border border-[#2a2926] bg-neutral-900/80 p-4" key={label}>
                <dt className="order-2 text-xs text-[#a8a29a]">{label}</dt>
                <dd className="order-1 text-xl">{value}</dd>
              </div>
            ))}
          </dl>
          <section aria-labelledby="jobs-heading" className="mt-6 rounded-md border border-[#2a2926] bg-neutral-900/80 px-4 py-4">
            <h2 id="jobs-heading">Vagas</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="sr-only" htmlFor="job-query">Buscar vaga ou empresa</label>
              <input className="w-full rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-xs text-slate-100 outline-none" id="job-query" maxLength={100} onChange={(event) => { setIsLoading(true); setError(null); setQuery(event.target.value) }} placeholder="Buscar vaga ou empresa" type="search" value={query} />
              <label className="sr-only" htmlFor="workplace-type">Modelo de trabalho</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-md border border-[#2a2926] bg-[#0e0e0d] py-3 pl-3 pr-10 text-xs text-slate-100 outline-none focus:border-[#a8a29a]" id="workplace-type" onChange={(event) => { setIsLoading(true); setError(null); setWorkplaceType(event.target.value) }} value={workplaceType}><option value="">Todos os modelos</option><option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="on_site">Presencial</option></select>
                <SelectChevron />
              </div>
              <label className="sr-only" htmlFor="max-age">Data de publicação</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-md border border-[#2a2926] bg-[#0e0e0d] py-3 pl-3 pr-10 text-xs text-slate-100 outline-none focus:border-[#a8a29a]" id="max-age" onChange={(event) => { setIsLoading(true); setError(null); setMaxAgeDays(event.target.value) }} value={maxAgeDays}><option value="">Todas as datas</option><option value="0">Hoje</option><option value="3">Últimos 3 dias</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select>
                <SelectChevron />
              </div>
            </div>
            {accountError && <p className="mt-4 text-xs text-red-400" role="alert">{accountError}</p>}
            <p aria-live="polite" className="mt-4 text-xs text-[#a8a29a]">{isLoading ? 'Carregando vagas...' : `${jobs.length} ${jobs.length === 1 ? 'vaga encontrada' : 'vagas encontradas'}`}</p>
            {error && <p className="mt-4 text-xs text-red-400" role="alert">{error}</p>}
            {!isLoading && !error && jobs.length === 0 && <p className="py-8 text-center text-sm text-[#a8a29a]">Nenhuma vaga encontrada. Tente outros filtros.</p>}
          {jobs.map((job) => (
            <article className="border-b border-[#2a2926] py-3 last:border-b-0" key={job.id}>
              <div className="flex flex-col gap-1 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between min-[360px]:gap-2">
                <button
                  aria-controls={`job-details-${job.id}`}
                  aria-expanded={expandedJobId === job.id}
                  className="flex min-w-0 flex-1 items-start justify-between gap-3 rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
                  onClick={() => setExpandedJobId((currentId) => currentId === job.id ? null : job.id)}
                  type="button"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm">{job.title}</span>
                    <span className="text-xs text-[#a8a29a]">{job.company} · {formatWorkplaceType(job.workplaceType)} · {formatPublishedAge(job.publishedAt)}</span>
                  </span>
                  <span aria-hidden="true" className="mt-1 text-lg leading-none text-[#a8a29a]">{expandedJobId === job.id ? '−' : '+'}</span>
                </button>
                {accountRole === 'admin' && 'status' in job && (
                  <select aria-label={`Status de ${job.title}`} className="h-8 self-end rounded-md border border-[#2a2926] bg-[#0e0e0d] px-2 text-xs text-slate-100 outline-none focus:border-[#a8a29a] disabled:opacity-50 min-[360px]:self-start" disabled={updatingJobId === job.id} onChange={(event) => void updateStatus(job.id, event.target.value as JobStatus)} value={job.status}>
                    {jobStatusValues.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                )}
              </div>
              <div
                aria-hidden={expandedJobId !== job.id}
                className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out motion-reduce:transition-none ${expandedJobId === job.id ? 'mt-3 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                id={`job-details-${job.id}`}
              >
                <div className="min-h-0">
                  <div className="rounded-md bg-[#171715] p-3">
                    <dl className="grid gap-x-4 gap-y-3 text-xs min-[360px]:grid-cols-2 lg:grid-cols-4">
                      <div><dt className="text-[#a8a29a]">Modelo</dt><dd className="mt-1">{formatWorkplaceType(job.workplaceType)}</dd></div>
                      <div><dt className="text-[#a8a29a]">Local</dt><dd className="mt-1">{job.location}</dd></div>
                      <div><dt className="text-[#a8a29a]">Publicada em</dt><dd className="mt-1">{formatPublishedDate(job.publishedAt)}</dd></div>
                      <div><dt className="text-[#a8a29a]">Fonte</dt><dd className="mt-1">{job.source === 'gupy' ? 'Gupy' : job.source}</dd></div>
                    </dl>
                    {safeJobUrl(job.url) && <a className="mt-4 inline-flex rounded-md border border-[#4a4842] px-3 py-2 text-xs text-slate-100 hover:border-[#a8a29a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300" href={safeJobUrl(job.url)!} rel="noopener noreferrer" tabIndex={expandedJobId === job.id ? 0 : -1} target="_blank">Ver vaga original ↗</a>}
                  </div>
                </div>
              </div>
            </article>
          ))}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App
