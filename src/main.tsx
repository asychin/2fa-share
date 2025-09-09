import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode.tsx'
import system from './theme.ts'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// If running as installed PWA, redirect to saved start URL if present
if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
  const savedUrl = localStorage.getItem('pwa_install_start_url')
  try {
    if (savedUrl && savedUrl !== window.location.href) {
      window.location.replace(savedUrl)
    }
  } catch {
    // ignore
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <App />
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>,
)
