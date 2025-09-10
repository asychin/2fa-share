# TOTP Generator (PWA)

[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org/) [![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=fff)](https://vitejs.dev/) [![Chakra UI](https://img.shields.io/badge/Chakra%20UI-319795?logo=chakraui&logoColor=fff)](https://chakra-ui.com/) [![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=fff)](https://web.dev/progressive-web-apps/) [![Vercel](https://img.shields.io/badge/Vercel-000?logo=vercel&logoColor=fff)](https://vercel.com/)

A tiny, privacy-friendly TOTP (Time‑based One‑Time Password) generator. Paste a Base32 secret to instantly get rotating verification codes, a shareable link, and a QR code. Everything runs in your browser — no backend.

> Add your screenshot here.

## Features
- Client‑side only: codes are generated locally (no data sent to a server)
- Paste a Base32 secret and get 6/8‑digit codes with a progress timer
- Shareable URL and QR code (compatible with authenticator apps)
- Light/Dark theme with persistent preference
- Installable PWA with offline support

## Quick start
```bash
npm i
npm run dev
# build & preview
npm run build
npm run preview
```

## Configuration (optional)
- `VITE_SITE_NAME`: App display name (defaults to "TOTP Generator")
- `VITE_PWA_THEME_COLOR`: Theme color for the PWA
- `VITE_PWA_BG_COLOR`: Background color for the PWA
- `VITE_BASE_URL`: Absolute base URL for generated links (fallbacks to current origin)

## How it works
- Uses `otpauth` to generate TOTP codes entirely in the browser
- Uses IndexedDB only for UI/PWA metadata (theme, install hints); secrets are not stored
- Share URLs include the secret in the query string for portability — share cautiously

## Tech stack
- React + TypeScript + Vite
- Chakra UI v3
- Service Worker (PWA)

## Deploy with Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/asychin/2fa-share)

## Deployment
The app is a static site. Deploy the `dist` folder to any static host (e.g. GitHub Pages, Netlify, Vercel). Ensure `sw.js` is served from the site root for PWA features.
