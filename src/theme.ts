import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

const config = defineConfig({
  cssVarsRoot: ':where(:root, :host, html)',
  globalCss: {
    '*, *::before, *::after': {
      boxSizing: 'border-box',
    },
    'html, body, #root': {
      height: '100%',
    },
  },
  theme: {
    // You can extend tokens/semanticTokens later as needed
    tokens: {},
    semanticTokens: {},
  },
})

const system = createSystem(defaultConfig, config)

export default system
