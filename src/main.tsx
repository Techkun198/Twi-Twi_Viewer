import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { CANONICAL_VIEWER_HOST, shouldRedirectToCanonical } from './viewerConfig.ts'

if (shouldRedirectToCanonical(window.location.hostname)) {
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
