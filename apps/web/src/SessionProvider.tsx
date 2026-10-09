import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authClient } from './auth'

type SessionState = { isCheckingSession: boolean; isAuthenticated: boolean }

const SessionContext = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ isCheckingSession: true, isAuthenticated: false })

  useEffect(() => {
    let active = true
    const { data: { subscription } } = authClient.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ isCheckingSession: false, isAuthenticated: Boolean(session?.user) })
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside SessionProvider.')
  return session
}
