import { useEffect, useMemo, useState } from 'react'
import { Box, Center, Container, Heading, HStack, IconButton, Input, Stack, Text, VStack, Clipboard, Progress, QrCode, Switch } from '@chakra-ui/react'
import * as OTPAuth from 'otpauth'
import { useColorMode } from './components/ui/color-mode.tsx'

function parseParams(): { secret?: string; label?: string; issuer?: string; period?: number; digits?: number } {
  const url = new URL(window.location.href)
  const secret = url.searchParams.get('secret') || undefined
  const label = url.searchParams.get('label') || undefined
  const issuer = url.searchParams.get('issuer') || undefined
  const period = Number(url.searchParams.get('period') || '30')
  const digits = Number(url.searchParams.get('digits') || '6')
  return { secret, label, issuer, period, digits }
}

function buildShareUrl(params: { secret: string; label?: string; issuer?: string; period?: number; digits?: number }) {
  const url = new URL(window.location.href)
  url.searchParams.set('secret', params.secret)
  if (params.label) url.searchParams.set('label', params.label)
  else url.searchParams.delete('label')
  if (params.issuer) url.searchParams.set('issuer', params.issuer)
  else url.searchParams.delete('issuer')
  if (params.period && params.period !== 30) url.searchParams.set('period', String(params.period))
  else url.searchParams.delete('period')
  if (params.digits && params.digits !== 6) url.searchParams.set('digits', String(params.digits))
  else url.searchParams.delete('digits')
  return url.toString()
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
  }, [totp, tick])

  const shareUrl = useMemo(() => {
    if (!validSecret) return ''
    return buildShareUrl({ secret, label, issuer, period, digits })
  }, [secret, label, issuer, period, digits, validSecret])

  const otpauthUrl = useMemo(() => {
    if (!validSecret) return ''
    return buildOtpAuthUrl({ secret, label, issuer, period, digits })
  }, [secret, label, issuer, period, digits, validSecret])

  useEffect(() => {
    if (validSecret && shareUrl) {
      window.history.replaceState(null, '', shareUrl)
    }
  }, [shareUrl, validSecret])

  const remainingPercent = Math.max(0, Math.min(100, (remaining / period) * 100))

  return (
    <Box minH="100dvh" w="100%" position="relative" px={4} bg="bg.canvas">
      <Center minH="100dvh">
        <Container py={8} maxW="md">
          <Stack gap={6}>
            <HStack justify="space-between" align="center">
              <Heading size="lg">TOTP Генератор</Heading>
              <Switch.Root onCheckedChange={() => toggleColorMode()} size="sm" colorPalette="teal">
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label srOnly>Тема</Switch.Label>
              </Switch.Root>
            </HStack>
            <Text color="fg.muted" textAlign="center">Вставьте Base32 секрет. Ссылка и QR генерируются автоматически. База данных не используется.</Text>

            <Stack p={4} gap={4} borderWidth="1px" borderRadius="md">
              <Input placeholder="Секрет (Base32)" value={secret} onChange={(e) => setSecret(e.target.value)} />
              <HStack>
                <Input placeholder="Метка (label)" value={label} onChange={(e) => setLabel(e.target.value)} />
                <Input placeholder="Издатель (issuer)" value={issuer} onChange={(e) => setIssuer(e.target.value)} />
              </HStack>
              <HStack>
                <Input type="number" min={10} max={120} step={1} placeholder="Период (sec)" value={period} onChange={(e) => setPeriod(Number(e.target.value || 30))} />
                <Input type="number" min={4} max={10} step={1} placeholder="Цифры" value={digits} onChange={(e) => setDigits(Number(e.target.value || 6))} />
              </HStack>
            </Stack>

            <Stack p={4} gap={4} align="center" borderWidth="1px" borderRadius="md">
              <Text fontWeight="medium">Статус: {validSecret ? 'валидный секрет' : 'некорректный секрет'}</Text>
              {validSecret && (
                <>
                  <Heading size="2xl" letterSpacing={4}>{code || '— — — — — —'}</Heading>
                  <Text color="fg.muted">обновится через {remaining}s</Text>
                  <Progress.Root w="full" value={remainingPercent} colorPalette="teal" variant="subtle">
                    <Progress.Track borderRadius="full">
                      <Progress.Range />
                    </Progress.Track>
                  </Progress.Root>
                  <QrCode.Root value={otpauthUrl} size="xl">
                    <QrCode.Frame>
                      <QrCode.Pattern />
                    </QrCode.Frame>
                  </QrCode.Root>
                  <VStack w="full" gap={3}>
                    <Clipboard.Root value={shareUrl}>
                      <HStack w="full">
                        <Clipboard.Input asChild>
                          <Input readOnly value={shareUrl} />
                        </Clipboard.Input>
                        <Clipboard.Trigger asChild>
                          <IconButton aria-label="Скопировать ссылку" variant="surface" size="sm">
                            <Clipboard.Indicator />
                          </IconButton>
                        </Clipboard.Trigger>
                      </HStack>
                    </Clipboard.Root>

                    <Clipboard.Root value={otpauthUrl}>
                      <HStack w="full">
                        <Clipboard.Input asChild>
                          <Input readOnly value={otpauthUrl} />
                        </Clipboard.Input>
                        <Clipboard.Trigger asChild>
                          <IconButton aria-label="Скопировать otpauth" variant="surface" size="sm">
                            <Clipboard.Indicator />
                          </IconButton>
                        </Clipboard.Trigger>
                      </HStack>
                    </Clipboard.Root>
                  </VStack>
                </>
              )}
            </Stack>

            <Text color="fg.muted" fontSize="sm" textAlign="center">Поддержка: Base32 секреты, параметры `label`, `issuer`, `period`, `digits` в URL. Данные хранятся только в URL.</Text>
          </Stack>
        </Container>
      </Center>
    </Box>
  )
}

export default App
