import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initTheme } from './lib/theme'
import './styles.css'

// Apply the saved (or default) palette before the first paint of the app.
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/+$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
