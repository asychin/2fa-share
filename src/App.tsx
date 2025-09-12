import { useEffect, useMemo, useState } from 'react'
import { Box, Center, Container, Heading, HStack, Icon, IconButton, Input, Link, Stack, Text, VStack, Clipboard, Progress, QrCode, Switch, Image } from '@chakra-ui/react'
import * as OTPAuth from 'otpauth'
import { useColorMode } from './components/ui/color-mode.tsx'
import { FaGithub, FaShareAlt, FaRegLightbulb } from 'react-icons/fa'
import { idbSet } from './utils/storage.ts'

const DEFAULT_NAME = import.meta.env.VITE_SITE_NAME || 'TOTP Generator'
const THEME_COLOR = import.meta.env.VITE_PWA_THEME_COLOR || '#0f172a'
const BG_COLOR = import.meta.env.VITE_PWA_BG_COLOR || '#0b1220'

const SITE_NAME = DEFAULT_NAME
const BASE_URL = (import.meta.env.VITE_BASE_URL as string | undefined) || ''

function absoluteUrl(relative: string) {
  try {
    if (BASE_URL) return new URL(relative, BASE_URL).toString()
    return new URL(relative, window.location.origin).toString()
  } catch {
    return relative
  }
}

function tryPostSW(message: unknown) {
  try {
    // Post to active controller if present; otherwise try active registration
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage(message)
    } else {
      navigator.serviceWorker?.getRegistration?.().then((reg) => reg?.active?.postMessage(message)).catch(() => {})
    }
  } catch {
    // Service worker communication failures are expected and should be ignored
  }
}

function tryParseOtpauth(otpauth: string): Partial<{ secret: string; label: string; issuer: string; period: number; digits: number }> | null {
  try {
    if (!otpauth.startsWith('otpauth://')) return null
    const url = new URL(otpauth)
    const rawLabel = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const search = url.searchParams
    const secret = search.get('secret') || undefined
    if (!secret) return null
    const issuer = search.get('issuer') || undefined
    const period = search.get('period') ? Number(search.get('period')) : undefined
    const digits = search.get('digits') ? Number(search.get('digits')) : undefined
    return {
      secret,
      label: rawLabel || 'TOTP',
      issuer: issuer || '',
      period: period ?? undefined,
      digits: digits ?? undefined,
    }
  } catch {
    return null
  }
}

function parseParams(): { secret?: string; label?: string; issuer?: string; period?: number; digits?: number } {
  const url = new URL(window.location.href)
  // Regular query params used by the app
  let secret = url.searchParams.get('secret') || undefined
  let label = url.searchParams.get('label') || undefined
  let issuer = url.searchParams.get('issuer') || undefined
  let period = Number(url.searchParams.get('period') || '30')
  let digits = Number(url.searchParams.get('digits') || '6')

  // Web Share Target (GET) params: url/text/title
  const sharedUrl = url.searchParams.get('url') || undefined
  const sharedText = url.searchParams.get('text') || undefined

  // Prefer explicit app params; if missing, try to derive from share target
  if (!secret) {
    // Try otpauth in shared URL
    if (sharedUrl) {
      const parsed = tryParseOtpauth(sharedUrl)
      if (parsed?.secret) {
        secret = parsed.secret
        if (parsed.label) label = parsed.label
        if (parsed.issuer) issuer = parsed.issuer
        if (parsed.period) period = parsed.period
        if (parsed.digits) digits = parsed.digits
      }
    }
    // Try otpauth inside shared text or extract secret=...
    if (!secret && sharedText) {
      const matchOtpauth = sharedText.match(/otpauth:\/\/[\^?\s]+/)
      if (matchOtpauth) {
        const parsed = tryParseOtpauth(matchOtpauth[0])
        if (parsed?.secret) {
          secret = parsed.secret
          if (parsed.label) label = parsed.label
          if (parsed.issuer) issuer = parsed.issuer
          if (parsed.period) period = parsed.period
          if (parsed.digits) digits = parsed.digits
        }
      } else {
        const secretMatch = sharedText.match(/secret=([A-Z2-7]+=*)/i)
        if (secretMatch) {
          secret = secretMatch[1]
        }
      }
    }
  }

  return { secret, label, issuer, period, digits }
}

function buildShareUrl(params: { secret: string; label?: string; issuer?: string; period?: number; digits?: number }) {
  const url = new URL(window.location.pathname + window.location.search, window.location.origin)
  url.searchParams.set('secret', params.secret)
  if (params.label) url.searchParams.set('label', params.label)
  else url.searchParams.delete('label')
  if (params.issuer) url.searchParams.set('issuer', params.issuer)
  else url.searchParams.delete('issuer')
  if (params.period && params.period !== 30) url.searchParams.set('period', String(params.period))
  else url.searchParams.delete('period')
  if (params.digits && params.digits !== 6) url.searchParams.set('digits', String(params.digits))
  else url.searchParams.delete('digits')
  return absoluteUrl(url.pathname + '?' + url.searchParams.toString())
}

function buildOtpAuthUrl(params: { secret: string; label?: string; issuer?: string; period?: number; digits?: number }) {
  const label = encodeURIComponent(params.label || 'TOTP')
  const search = new URLSearchParams()
  search.set('secret', params.secret)
  if (params.issuer) search.set('issuer', params.issuer)
  if (params.period && params.period !== 30) search.set('period', String(params.period))
  if (params.digits && params.digits !== 6) search.set('digits', String(params.digits))
  return `otpauth://totp/${label}?${search.toString()}`
}

function useTick(periodSeconds: number) {
  const [, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.floor(Date.now() / 1000)
  return seconds % periodSeconds
}

function App() {
  const initial = parseParams()
  const [secret, setSecret] = useState<string>(initial.secret || '')
  const [label, setLabel] = useState<string>(initial.label || '')
  const [issuer, setIssuer] = useState<string>(initial.issuer || '')
  const [period, setPeriod] = useState<number>(initial.period || 30)
  const [digits, setDigits] = useState<number>(initial.digits || 6)
  const { toggleColorMode } = useColorMode()

  const validSecret = useMemo(() => {
    try {
      if (!secret) return false
      OTPAuth.Secret.fromBase32(secret.replace(/\s+/g, ''))
      return true
    } catch {
      return false
    }
  }, [secret])

  const totp = useMemo(() => {
    if (!validSecret) return null
    try {
      const otp = new OTPAuth.TOTP({
        algorithm: 'SHA1',
        digits,
        period,
        secret: OTPAuth.Secret.fromBase32(secret.replace(/\s+/g, '')),
        issuer: issuer || undefined,
        label: label || undefined,
      })
      return otp
    } catch {
      return null
    }
  }, [secret, issuer, label, digits, period, validSecret])

  const tick = useTick(period)
  const remaining = period - tick
  const code = useMemo(() => {
    try {
      return totp?.generate() || ''
    } catch {
      return ''
    }
  }, [totp])

  const shareUrl = useMemo(() => {
    if (!validSecret) return ''
    return buildShareUrl({ secret, label, issuer, period, digits })
  }, [secret, label, issuer, period, digits, validSecret])

  const otpauthUrl = useMemo(() => {
    if (!validSecret) return ''
    return buildOtpAuthUrl({ secret, label, issuer, period, digits })
  }, [secret, label, issuer, period, digits, validSecret])

  const displayName = useMemo(() => {
    const suffix = label && label.trim() ? label.trim() : 'noname'
    return `${SITE_NAME} | ${suffix}`
  }, [label])

  useEffect(() => {
    document.title = displayName
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_COLOR)
    // iOS web app title from .env
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    if (!appleTitle) {
      appleTitle = document.createElement('meta')
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title')
      document.head.appendChild(appleTitle)
    }
    appleTitle.setAttribute('content', SITE_NAME)
  }, [displayName])

  useEffect(() => {
    if (validSecret && shareUrl) {
      window.history.replaceState(null, '', shareUrl)
    }
    // Inform SW so it can expose dynamic manifest fields
    tryPostSW({ type: 'SET_PWA_NAME', name: SITE_NAME })
    if (validSecret && shareUrl) {
      tryPostSW({ type: 'SET_PWA_LAUNCH_URL', url: shareUrl })
    } else {
      tryPostSW({ type: 'CLEAR_PWA_LAUNCH_URL' })
    }
  }, [shareUrl, validSecret])

  // Keep dynamic metadata for PWA install: app name from label/env, colors and start URL
  useEffect(() => {
    try {
      void idbSet('pwa_install_name', displayName)
      void idbSet('pwa_theme_color', THEME_COLOR)
      void idbSet('pwa_bg_color', BG_COLOR)
      if (validSecret && shareUrl) {
        void idbSet('pwa_install_start_url', shareUrl)
      }
    } catch {
      // ignore
    }
  }, [displayName, validSecret, shareUrl])

  const remainingPercent = Math.max(0, Math.min(100, (remaining / period) * 100))

  async function handleNativeShare() {
    try {
      if (!navigator.share || !validSecret || !shareUrl) return
      const shareTitle = displayName
      const shareText = issuer && issuer.trim() ? `${shareTitle} · ${issuer.trim()}` : shareTitle
      await navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
    } catch {
      // user may cancel share
    }
  }

  return (
    <Box minH="100dvh" w="100%" bg="bg.canvas" px={4} display="flex" flexDir="column">
      <Center flex="1">
          <Container py={6} maxW={{ base: 'sm', md: 'md' }}>
          <Stack gap={5}>
            <HStack justify="space-between" align="center" wrap="wrap" gap={3}>
              <HStack align="center" gap={2}>
                <Image src="/icons/logo.png" alt="TOTP logo" boxSize={{ base: '44px', md: '48px' }} />
                <Heading size={{ base: 'md', md: 'lg' }}>Generator</Heading>
              </HStack>
              <HStack gap={3} align="center">
                <Icon as={FaRegLightbulb} color="fg.muted" boxSize="5" />
                <Switch.Root onCheckedChange={() => toggleColorMode()} size="sm" colorPalette="teal">
                  <Switch.HiddenInput />
                  <Switch.Control transform="rotate(90deg)" transformOrigin="center">
                    <Switch.Thumb />
                  </Switch.Control>
                  <Switch.Label srOnly>Theme</Switch.Label>
                </Switch.Root>
              </HStack>
            </HStack>
            <Text color="fg.muted" textAlign="center">Paste a Base32 secret. The link and QR are generated automatically. No database is used.</Text>

            <Stack p={4} gap={3} borderWidth="1px" borderRadius="md">
              <Input placeholder="Secret (Base32)" value={secret} onChange={(e) => setSecret(e.target.value)} />
              <Stack direction={{ base: 'column', sm: 'row' }} gap={3}>
                <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Input placeholder="Issuer" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              </Stack>
              <Stack direction={{ base: 'column', sm: 'row' }} gap={3}>
                <Input type="number" min={10} max={120} step={1} placeholder="Period (sec)" value={period} onChange={(e) => setPeriod(Number(e.target.value || 30))} />
                <Input type="number" min={4} max={10} step={1} placeholder="Digits" value={digits} onChange={(e) => setDigits(Number(e.target.value || 6))} />
              </Stack>
            </Stack>

            <Stack p={4} gap={4} align="center" borderWidth="1px" borderRadius="md">
              <Text fontWeight="medium">Status: {validSecret ? 'valid secret' : 'Paste a secret'}</Text>
              {validSecret && (
                <>
                  <Clipboard.Root value={code}>
                    <HStack w="full" gap={2} align="center">
                      <Heading size={{ base: 'xl', md: '2xl' }} letterSpacing={4}>{code || '— — — — — —'}</Heading>
                      <Clipboard.Trigger asChild>
                        <IconButton aria-label="Copy code" variant="surface" size="sm">
                          <Clipboard.Indicator />
                        </IconButton>
                      </Clipboard.Trigger>
                    </HStack>
                  </Clipboard.Root>
                  <Text color="fg.muted">updates in {remaining}s</Text>
                  <Progress.Root w="full" value={remainingPercent} colorPalette="teal" variant="subtle">
                    <Progress.Track borderRadius="full">
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                  <QrCode.Root value={otpauthUrl} size={{ base: 'md', md: 'xl' }}>
                    <QrCode.Frame>
                      <QrCode.Pattern />
                    </QrCode.Frame>
                  </QrCode.Root>
                  <VStack w="full" gap={3}>
                    <Clipboard.Root value={shareUrl}>
                      <HStack w="full" gap={2} align="center">
                        <Clipboard.Input asChild>
                          <Input readOnly value={shareUrl} flex="1" minW={0} />
                        </Clipboard.Input>
                        <HStack gap={2} w="96px" justify="flex-start" flexShrink={0}>
                          <Clipboard.Trigger asChild>
                            <IconButton aria-label="Copy link" variant="surface" size="sm">
                              <Clipboard.Indicator />
                            </IconButton>
                          </Clipboard.Trigger>
                          <IconButton aria-label="Share" variant="surface" size="sm" onClick={handleNativeShare} disabled={!navigator.share}>
                            <FaShareAlt />
                          </IconButton>
                        </HStack>
                      </HStack>
                    </Clipboard.Root>

                    <Clipboard.Root value={otpauthUrl}>
                      <HStack w="full" gap={2} align="center">
                        <Clipboard.Input asChild>
                          <Input readOnly value={otpauthUrl} flex="1" minW={0} />
                        </Clipboard.Input>
                        <HStack gap={2} w="96px" justify="flex-start" flexShrink={0}>
                          <Clipboard.Trigger asChild>
                            <IconButton aria-label="Copy otpauth" variant="surface" size="sm">
                              <Clipboard.Indicator />
                            </IconButton>
                          </Clipboard.Trigger>
                        </HStack>
                      </HStack>
                    </Clipboard.Root>
                  </VStack>
                </>
              )}
            </Stack>


          </Stack>
        </Container>
      </Center>
      <Box as="footer" py={5} borderTopWidth="1px">
        <HStack justify="center" gap={3} color="fg.muted">
          <Text>Made with</Text>
          <Text as="span" color="red.500">❤</Text>
          <Link href="https://github.com/asychin/2fa-share" target="_blank" rel="noopener noreferrer" aria-label="GitHub repository" display="inline-flex" alignItems="center" transition="all 0.2s" _hover={{ color: 'fg', transform: 'translateY(-1px)' }}>
            <Icon as={FaGithub} boxSize="5" />
          </Link>
        </HStack>
      </Box>
    </Box>
  )
}

export default App
