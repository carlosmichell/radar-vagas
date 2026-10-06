import { type FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { authClient } from './auth'

type AuthMode = 'signIn' | 'signUp'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('signIn')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    void authClient.auth.getSession()
      .then(({ data }) => setIsAuthenticated(Boolean(data.session?.user)))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsCheckingSession(false))
  }, [])

  if (isCheckingSession) {
    return <main className="min-h-screen bg-[#0e0e0d] p-6 text-sm text-[#6f6a62]">Verificando sessão...</main>
  }

  if (isAuthenticated) return <Navigate replace to="/" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'signUp') {
        const result = await authClient.auth.signUp({
          email,
          password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        })
        if (result.error) throw new Error(result.error.message ?? 'Não foi possível criar a conta.')
        if (result.data.session) {
          navigate('/', { replace: true })
          return
        }
        setMode('signIn')
        setPassword('')
        setNotice('Conta criada. Confirme seu e-mail, se solicitado, e entre para continuar.')
        return
      }

      const result = await authClient.auth.signInWithPassword({ email, password })
      if (result.error) throw new Error(result.error.message ?? 'Não foi possível entrar.')
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível autenticar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e0d] px-4 text-slate-100">
      <section className="w-full max-w-sm rounded-md border border-[#2a2926] bg-neutral-900/80 p-6">
        <h1 className="text-xl font-bold">{mode === 'signIn' ? 'Entrar no Radar' : 'Criar conta de teste'}</h1>
        <p className="mt-2 text-sm text-[#6f6a62]">
          {mode === 'signIn' ? 'Entre para acessar o dashboard de vagas.' : 'Contas novas podem visualizar vagas, sem alterar status.'}
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === 'signUp' && (
            <label className="flex flex-col gap-2 text-sm">
              Nome
              <input className="rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-sm outline-none" onChange={(event) => setName(event.target.value)} required value={name} />
            </label>
          )}
          <label className="flex flex-col gap-2 text-sm">
            E-mail
            <input className="rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-sm outline-none" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Senha
            <input className="rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-sm outline-none" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {notice && <p className="text-sm text-emerald-400">{notice}</p>}
          <button className="rounded-md bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde...' : mode === 'signIn' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button className="mt-5 text-sm text-[#a8a29a]" onClick={() => { setMode(mode === 'signIn' ? 'signUp' : 'signIn'); setError(null); setNotice(null) }} type="button">
          {mode === 'signIn' ? 'Criar uma conta de teste' : 'Já tenho uma conta'}
        </button>
      </section>
    </main>
  )
}
