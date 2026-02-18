'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState
} from 'react'

const Ctx = createContext<(text: string) => void>(() => {})

let nextId = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])

  const push = useCallback((text: string) => {
    const id = nextId++
    setToasts(prev => [...prev.slice(-5), { id, text }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}

      {toasts.length > 0 && (
        <div className="fixed right-4 top-12 z-50 space-y-1">
          {toasts.map(t => (
            <div
              className="bg-black/80 px-3 py-1.5 font-['Courier_New',monospace] text-xs text-white shadow"
              key={t.id}
            >
              {t.text}
            </div>
          ))}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
