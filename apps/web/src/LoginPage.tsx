import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { authClient } from './auth'
import { useSession } from './SessionProvider'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { isCheckingSession, isAuthenticated } = useSession()
  const [error, setError] = useState<string | null>(null)

  if (isCheckingSession) {
    return <main className="min-h-screen bg-[#0e0e0d] p-6 text-sm text-[#a8a29a]">Verificando sessão...</main>
  }

  if (isAuthenticated) return <Navigate replace to="/" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await authClient.auth.signInWithPassword({ email, password })
      if (result.error) throw new Error(result.error.message ?? 'Não foi possível entrar.')
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível autenticar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signInAsVisitor() {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await authClient.auth.signInAnonymously()
      if (result.error) throw new Error(result.error.message ?? 'Não foi possível iniciar o acesso como visitante.')
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível iniciar o acesso como visitante.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0e0e0d] px-4 text-slate-100">
      <section className="w-full max-w-sm rounded-md border border-[#2a2926] bg-neutral-900/80 p-6">
        <h1 className="text-xl font-bold">Entrar no Radar</h1>
        <p className="mt-2 text-sm text-[#a8a29a]">Entre com sua conta ou explore as vagas como visitante.</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm">E-mail
            <input autoComplete="email" className="rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-sm outline-none focus:border-[#a8a29a]" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          </label>
          <label className="flex flex-col gap-2 text-sm">Senha
            <input autoComplete="current-password" className="rounded-md border border-[#2a2926] bg-[#0e0e0d] px-3 py-3 text-sm outline-none focus:border-[#a8a29a]" minLength={8} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          {error && <p className="text-sm text-red-400" role="alert">{error}</p>}
          <button className="rounded-md bg-slate-100 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100 disabled:opacity-60" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Aguarde...' : 'Entrar'}
          </button>
        </form>

        <div className="my-5 border-t border-[#2a2926]" />
        <button className="w-full rounded-md border border-[#4a4842] px-4 py-3 text-sm text-slate-100 hover:border-[#a8a29a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100 disabled:opacity-60" disabled={isSubmitting} onClick={() => void signInAsVisitor()} type="button">Explorar como visitante</button>
        <p className="mt-2 text-center text-xs text-[#a8a29a]">Visualize as vagas sem criar uma conta.</p>
      </section>
    </main>
  )
}
