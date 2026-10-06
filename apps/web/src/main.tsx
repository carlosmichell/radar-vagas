import { StrictMode, useEffect, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import '@fontsource-variable/sora'
import './index.css'

function createRandomUuid() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: createRandomUuid,
  })
}

const [{ default: App }, { default: LoginPage }, { authClient }] = await Promise.all([
  import('./App.tsx'),
  import('./LoginPage.tsx'),
  import('./auth.ts'),
])

function RequireAuthentication({ children }: { children: ReactNode }) {
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    void authClient.auth.getSession()
      .then(({ data }) => setIsAuthenticated(Boolean(data.session?.user)))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setIsCheckingSession(false))
  }, [])

  if (isCheckingSession) {
    return <main className="min-h-screen bg-[#0e0e0d] p-6 text-sm text-[#6f6a62]">Verificando acesso...</main>
  }

  return isAuthenticated ? <>{children}</> : <Navigate replace to="/login" />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<RequireAuthentication><App /></RequireAuthentication>} path="/" />
        <Route element={<LoginPage />} path="/login" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
