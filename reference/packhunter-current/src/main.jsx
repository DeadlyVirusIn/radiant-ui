import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { LanguageProvider } from './contexts/LanguageContext'
// 2026-04-20 Phase 4B — Operator Mode (UI-only sidebar filter).
import { OperatorModeProvider } from './contexts/OperatorModeContext'
// 2026-04-20 Phase 5 — Adaptive Nav (Quick Access / Recent / Pinned).
import { QuickAccessProvider } from './contexts/QuickAccessContext'
import App from './App'

// Load Inter font weights locally (no Google Fonts dependency)
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'

// Detect saved theme to set initial body background (prevents flash)
const savedTheme = localStorage.getItem('theme-mode') || 'light'
const isDarkInit = savedTheme === 'dark'

// Add global styles
const globalStyles = document.createElement('style')
globalStyles.innerHTML = `
  html {
    scroll-behavior: smooth;
  }

  body {
    background: ${isDarkInit
      ? 'linear-gradient(135deg, #0B0F19, #111827, #0F172A)'
      : 'linear-gradient(135deg, #F0F2F8, #F8F9FC, #EEF0F6)'};
    min-height: 100vh;
    transition: background 0.3s ease;
  }

  body.theme-dark {
    background: linear-gradient(135deg, #0B0F19, #111827, #0F172A);
  }

  body.theme-light {
    background: linear-gradient(135deg, #F0F2F8, #F8F9FC, #EEF0F6);
  }

  ::selection {
    background: rgba(124, 138, 255, 0.3);
    color: ${isDarkInit ? '#E4E4E7' : '#1E293B'};
  }

  :focus-visible {
    outline: 2px solid rgba(124, 138, 255, 0.6);
    outline-offset: 2px;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(124, 138, 255, 0.3);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(124, 138, 255, 0.5);
  }
`
document.head.appendChild(globalStyles)

// Set initial body class for theme
document.body.classList.add(isDarkInit ? 'theme-dark' : 'theme-light')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <OperatorModeProvider>
            <QuickAccessProvider>
              <App />
            </QuickAccessProvider>
          </OperatorModeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
