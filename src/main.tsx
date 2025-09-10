import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode.tsx'
import system from './theme.ts'
import { idbGet } from './utils/storage.ts'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

async function bootstrap() {
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
    try {
      const savedUrl = await idbGet<string>('pwa_install_start_url')
      if (savedUrl && savedUrl !== window.location.href) {
        window.location.replace(savedUrl)
        return
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
}

void bootstrap()
