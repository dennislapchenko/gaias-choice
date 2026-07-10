import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initTheme } from './lib/theme'
import { currentLocale, initI18n, stripBase, storedLocale, I18nProvider } from './lib/i18n'
import './styles.css'

// Apply the saved (or default) palette before the first paint of the app.
initTheme()
// Set <html lang> to the URL's locale before the first paint.
initI18n()

const BASE = import.meta.env.BASE_URL
const locale = currentLocale()

if (locale === 'ru' && storedLocale() === 'en' && stripBase(window.location.pathname) === '') {
  // A returning EN-preferring visitor on the bare root gets their tree before
  // anything paints. Deep links never redirect, and crawlers store nothing —
  // they always see the RU tree at '/'.
  window.location.replace(BASE + 'en' + window.location.search + window.location.hash)
} else {
  // The router basename carries base + locale ('/en' tree vs unprefixed RU),
  // so every <Link>/navigate() stays locale-aware with no per-link code.
  const basename = (BASE + (locale === 'en' ? 'en' : '')).replace(/\/+$/, '') || '/'
  const container = document.getElementById('root')!
  const app = (
    <React.StrictMode>
      <BrowserRouter basename={basename}>
        <I18nProvider locale={locale}>
          <App />
        </I18nProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
  // Prerendered pages arrive with real HTML in #root — attach to it. The dev
  // server's empty shell (and any non-prerendered host) mounts from scratch.
  if (container.hasChildNodes()) ReactDOM.hydrateRoot(container, app)
  else ReactDOM.createRoot(container).render(app)
}
