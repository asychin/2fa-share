import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { idbGet, idbSet } from '../../utils/storage.ts'

export type ColorMode = 'light' | 'dark'

type ColorModeContextValue = {
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  toggleColorMode: () => void
}

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined)

function getSystemMode(): ColorMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyHtmlClass(mode: ColorMode) {
  const el = document.documentElement
  el.classList.remove('light', 'dark')
  el.classList.add(mode)
}

export function ColorModeProvider(props: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() => {
    return getSystemMode()
  })

  useEffect(() => {
    ;(async () => {
      try {
        const saved = (await idbGet<ColorMode>('theme'))
        if (saved) setMode(saved)
      } catch {
        void 0
      }
    })()
  }, [])

  useEffect(() => {
    applyHtmlClass(mode)
    try {
      void idbSet('theme', mode)
    } catch {
      void 0
    }
  }, [mode])

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      idbGet<ColorMode>('theme').then((saved) => {
        if (!saved) setMode(getSystemMode())
      }).catch(() => void 0)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const setColorMode = useCallback((m: ColorMode) => setMode(m), [])
  const toggleColorMode = useCallback(() => setMode((m) => (m === 'light' ? 'dark' : 'light')), [])

  const value = useMemo<ColorModeContextValue>(() => ({ colorMode: mode, setColorMode, toggleColorMode }), [mode, setColorMode, toggleColorMode])

  return <ColorModeContext.Provider value={value}>{props.children}</ColorModeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useColorMode() {
  const ctx = useContext(ColorModeContext)
  if (!ctx) throw new Error('useColorMode must be used within ColorModeProvider')
  return ctx
}

// eslint-disable-next-line react-refresh/only-export-components
export function useColorModeValue<TValue>(light: TValue, dark: TValue): TValue {
  const { colorMode } = useColorMode()
  return colorMode === 'light' ? light : dark
}

export function LightMode(props: { children: React.ReactNode }) {
  return <div className="light">{props.children}</div>
}

export function DarkMode(props: { children: React.ReactNode }) {
  return <div className="dark">{props.children}</div>
}
