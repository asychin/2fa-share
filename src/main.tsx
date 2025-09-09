import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeProvider } from './components/ui/color-mode.tsx'
import system from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ColorModeProvider>
        <App />
      </ColorModeProvider>
    </ChakraProvider>
  </StrictMode>,
)
