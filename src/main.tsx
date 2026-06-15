import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const CANONICAL_VIEWER_HOST = 'viewer.twi-twi.com'
const CLOUDFLARE_PAGES_HOST = 'twi-twi-viewer.pages.dev'

if (window.location.hostname === CLOUDFLARE_PAGES_HOST) {
  const nextUrl = new URL(window.location.href)
  nextUrl.protocol = 'https:'
  nextUrl.hostname = CANONICAL_VIEWER_HOST
  nextUrl.port = ''
  window.location.replace(nextUrl.toString())
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
