import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { authClient } from './auth'

type JobStatus = 'new' | 'saved' | 'applied' | 'discarded'

type Summary = { total: number; new: number; saved: number; applied: number; discarded: number }
type Job = {
  id: string
  title: string
  company: string
  location: string
  workplaceType: string
  technology: string | null
  url: string
  source: string
  publishedAt: string | null
  status: JobStatus
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? '/api'
function apiUrl(path: string) { return `${apiBaseUrl.replace(/\/$/, '')}${path}` }

function formatPublishedAge(publishedAt: string | null) {
  if (!publishedAt) return 'Data não informada'
  const publishedDate = new Date(publishedAt)
  if (Number.isNaN(publishedDate.getTime())) return 'Data não informada'
  const days = Math.max(0, Math.floor((Date.now() - publishedDate.getTime()) / 86_400_000))
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Há 1 dia'
  return `Há ${days} dias`
}

function App() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<Summary>({ total: 0, new: 0, saved: 0, applied: 0, discarded: 0 })
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [workplaceType, setWorkplaceType] = useState('')
  const [maxAgeDays, setMaxAgeDays] = useState('')
  const [accountRole, setAccountRole] = useState<'loading' | 'admin' | 'viewer' | 'error'>('loading')
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [accountError, setAccountError] = useState<string | null>(null)
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)

  async function loadSummary() {
    const response = await fetch(apiUrl('/jobs/summary'), { headers: await getAuthHeaders() })
    if (!response.ok) throw new Error('Could not load summary.')
    setSummary(await response.json())
  }

  useEffect(() => {
    void loadSummary().catch(() => undefined)
    void (async () => {
      const response = await fetch(apiUrl('/auth/me'), { headers: await getAuthHeaders() })
        if (!response.ok) throw new Error(`A API recusou a sessão (HTTP ${response.status}).`)
        const account = (await response.json()) as { userId: string; role: string }
        setAuthUserId(account.userId)
        setAccountRole(account.role === 'admin' ? 'admin' : 'viewer')
    })().catch((cause: unknown) => {
      setAccountRole('error')
      setAccountError(cause instanceof Error ? cause.message : 'Não foi possível obter um token de acesso.')
    })
  }, [])

  useEffect(() => {
    const parameters = new URLSearchParams()
    if (query) parameters.set('query', query)
    if (workplaceType) parameters.set('workplaceType', workplaceType)
    if (maxAgeDays) parameters.set('maxAgeDays', maxAgeDays)

    async function loadJobs() {
      setError(null)
      try {
        const suffix = parameters.size ? `?${parameters}` : ''
        const response = await fetch(apiUrl(`/jobs${suffix}`), { headers: await getAuthHeaders() })
        if (!response.ok) throw new Error('Could not load jobs.')
        const data = await response.json()
        setJobs(data.items)
      } catch {
        setError('Não foi possível carregar as vagas.')
      } finally {
        setIsLoading(false)
      }
    }
    void loadJobs()
  }, [query, workplaceType, maxAgeDays])

  async function updateStatus(id: string, status: JobStatus) {
    if (accountRole !== 'admin') return
    setUpdatingJobId(id)
    setError(null)
    try {
      const authHeaders = await getAuthHeaders()
      const response = await fetch(apiUrl(`/jobs/${id}/status`), {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error('Could not update status.')
      const updatedJob = (await response.json()) as Job
      setJobs((currentJobs) => currentJobs.map((job) => (job.id === id ? updatedJob : job)))
      await loadSummary()
    } catch {
      setError('Não foi possível atualizar o status. Entre na sua conta e tente novamente.')
    } finally {
      setUpdatingJobId(null)
    }
  }

  async function signOut() {
    await authClient.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#0e0e0d] px-4 py-4 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-bold text-lg">Radar de Vagas</h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-[#6f6a62]">
              {accountRole === 'loading' && 'Verificando acesso...'}
              {accountRole === 'admin' && 'Admin'}
              {accountRole === 'viewer' && 'Visualização'}
              {accountRole === 'error' && 'Não foi possível validar o acesso'}
            </span>
            {accountError && <p className="text-[10px] text-red-400">{accountError}</p>}
            {accountRole === 'viewer' && authUserId && (
              <p className="text-[10px] text-[#6f6a62]" title="ID de usuário retornado pela API">
                ID: {authUserId}
              </p>
            )}
          </div>
          <button className="text-xs text-[#6f6a62]" onClick={() => void signOut()} type="button">Sair</button>
        </div>
      </header>
      <main>
        <section className="mt-4 flex flex-col gap-1 text-[#6f6a62]"><h2>Últimas vagas encontradas</h2><p>Resultados coletados diariamente na Gupy.</p></section>
        <section className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-md border border-[#2a2926] bg-neutral-900/80 p-4"><dd className="text-xl">{summary.new}</dd><dt className="text-sm text-[#6f6a62]">vagas novas</dt></div>
          <div className="rounded-md border border-[#2a2926] bg-neutral-900/80 p-4"><dd className="text-xl">{summary.saved}</dd><dt className="text-sm text-[#6f6a62]">salvas</dt></div>
          <div className="rounded-md border border-[#2a2926] bg-neutral-900/80 p-4"><dd className="text-xl">{summary.applied}</dd><dt className="text-sm text-[#6f6a62]">candidaturas</dt></div>
          <div className="rounded-md border border-[#2a2926] bg-neutral-900/80 p-4"><dd className="text-xl">{summary.total ? Math.round((summary.applied / summary.total) * 100) : 0}%</dd><dt className="text-sm text-[#6f6a62]">das vagas viraram candidaturas</dt></div>
        </section>
        <section className="mt-6 rounded-md border border-[#2a2926] bg-neutral-900/80 px-4 py-4">
          <h2 className="px-1">Vagas</h2>
          <div className="grid grid-cols-2 gap-2">
            <input className="mt-4 w-full rounded-md border border-[#2a2926] bg-neutral-900/80 px-2 py-3 text-xs text-slate-100 outline-none" onChange={(event) => { setIsLoading(true); setQuery(event.target.value) }} placeholder="Digite o nome da vaga" value={query} />
            <select className="mt-4 w-full rounded-md border border-[#2a2926] bg-neutral-900/80 px-2 py-3 text-xs text-slate-100 outline-none" onChange={(event) => { setIsLoading(true); setWorkplaceType(event.target.value) }} value={workplaceType}><option value="">Todos os modelos</option><option value="remote">Remoto</option><option value="hybrid">Híbrido</option><option value="on_site">Presencial</option></select>
          </div>
          <select className="mt-4 w-full rounded-md border border-[#2a2926] bg-neutral-900/80 p-3 text-xs text-slate-100 outline-none" onChange={(event) => { setIsLoading(true); setMaxAgeDays(event.target.value) }} value={maxAgeDays}><option value="">Todas as datas</option><option value="0">Hoje</option><option value="3">Últimos 3 dias</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option></select>
          {isLoading && <p className="mt-6 text-xs text-[#6f6a62]">Carregando vagas...</p>}
          {error && <p className="mt-6 text-xs text-red-400">{error}</p>}
          {!isLoading && !error && jobs.length === 0 && <p className="mt-6 text-xs text-[#6f6a62]">Nenhuma vaga encontrada.</p>}
          {jobs.map((job) => <article className="flex justify-between border-b border-[#2a2926] py-3" key={job.id}><div className="flex flex-col gap-1"><h3 className="text-sm">{job.title}</h3><p className="text-xs text-[#6f6a62]">{job.company} • {job.workplaceType} • {formatPublishedAge(job.publishedAt)}</p></div>{accountRole === 'admin' ? <select className="ml-2 h-8 rounded-md border border-[#2a2926] bg-neutral-900/80 p-2 text-xs text-slate-100 outline-none" disabled={updatingJobId === job.id} onChange={(event) => void updateStatus(job.id, event.target.value as JobStatus)} value={job.status}><option value="new">Nova</option><option value="saved">Salva</option><option value="applied">Candidatado</option><option value="discarded">Descartada</option></select> : <span className="ml-2 self-center text-xs text-[#6f6a62]">{job.status}</span>}</article>)}
        </section>
      </main>
    </div>
  )
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data, error } = await authClient.auth.getSession()
  if (error) {
    throw new Error(`Supabase Auth não conseguiu recuperar a sessão: ${error.message}`)
  }
  const token = data.session?.access_token
  if (!token) {
    throw new Error('A sessão expirou. Entre novamente para continuar.')
  }
  return { Authorization: `Bearer ${token}` }
}

export default App
