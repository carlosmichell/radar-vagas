import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { jobStatusValues, type JobDto, type JobStatus, type JobsSummary } from '@radar-vagas/contracts'
import { getAccount, getJobs, getSummary, updateJobStatus } from './apiClient'
import { authClient } from './auth'

const statusLabels: Record<JobStatus, string> = {
  new: 'Nova',
  saved: 'Salva',
  applied: 'Candidatado',
  discarded: 'Descartada',
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

function App() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<JobsSummary>({ total: 0, new: 0, saved: 0, applied: 0, discarded: 0 })
  const [jobs, setJobs] = useState<JobDto[]>([])
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
    setSummary(await getSummary())
  }

  useEffect(() => {
    void loadSummary().catch(() => undefined)
    void getAccount()
      .then((account) => {
        setAuthUserId(account.userId)
        setAccountRole(account.role)
      })
      .catch((cause: unknown) => {
        setAccountRole('error')
        setAccountError(cause instanceof Error ? cause.message : 'Não foi possível obter um token de acesso.')
      })
  }, [])

  useEffect(() => {
    async function loadJobs() {
      setError(null)
      try {
        const data = await getJobs({
          query,
          workplaceType,
          maxAgeDays: maxAgeDays ? Number(maxAgeDays) : undefined,
        })
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
        <dl className="mt-6 grid grid-cols-2 gap-4">
          {summaryCards(summary).map(({ label, value }) => (
            <div className="flex flex-col rounded-md border border-[#2a2926] bg-neutral-900/80 p-4" key={label}>
              <dt className="order-2 text-sm text-[#6f6a62]">{label}</dt>
              <dd className="order-1 text-xl">{value}</dd>
            </div>
          ))}
        </dl>
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
          {jobs.map((job) => (
            <article className="flex justify-between border-b border-[#2a2926] py-3" key={job.id}>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm">{job.title}</h3>
                <p className="text-xs text-[#6f6a62]">{job.company} • {job.workplaceType} • {formatPublishedAge(job.publishedAt)}</p>
              </div>
              {accountRole === 'admin' ? (
                <select className="ml-2 h-8 rounded-md border border-[#2a2926] bg-neutral-900/80 p-2 text-xs text-slate-100 outline-none" disabled={updatingJobId === job.id} onChange={(event) => void updateStatus(job.id, event.target.value as JobStatus)} value={job.status}>
                  {jobStatusValues.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
              ) : <span className="ml-2 self-center text-xs text-[#6f6a62]">{statusLabels[job.status]}</span>}
            </article>
          ))}
        </section>
      </main>
    </div>
  )
}

export default App
