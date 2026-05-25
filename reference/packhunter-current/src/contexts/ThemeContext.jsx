import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import GlobalStyles from '@mui/material/GlobalStyles'
import {
  designTokens,
  typographyScale,
  monoFontFamily,
  lightGlass as lightGlassTokens,
  darkGlass  as darkGlassTokens,
} from '../theme/designTokens'
import { buildGlobalStyles } from '../theme/globalStyles'

const ThemeContext = createContext()

// Shared card styles (blur removed from global cards for GPU performance)
const glassCard = {
  borderRadius: 16,
}

// ── Mobile bottom-nav scroll safety (cross-page rules) ──────────────
//
// The fixed MobileBottomNav overlays the bottom of the viewport on
// any device where useIsMobileDevice() returns true (small viewports
// AND touchscreen laptops with wide viewports). The shell defines a
// CSS variable --mobile-nav-offset (see App.jsx) that resolves to
// `nav height + buffer + safe-area` when the nav renders and `0px`
// otherwise.
//
// These global rules apply that offset wherever scrolling actually
// happens, regardless of which container the page chooses:
//
//   * `main`                    → page-level body scroll: keeps
//                                 scrollIntoView landings above the
//                                 nav.
//   * `[data-scroll-container]` → opt-in tag for true inner-overflow
//                                 surfaces (tables, drawers, the
//                                 Tracker content area). Honors the
//                                 offset for both scroll-into-view
//                                 and visual padding. Also enables
//                                 iOS momentum scroll for PWAs.
//   * `[data-page-root]`        → opt-in tag for page roots with
//                                 bespoke max-width / column layouts
//                                 that the global <main> padding
//                                 cannot reach.
//
// `html, body, #root { height: 100% }` + `main { min-height: 100% }`
// guarantees that short-content pages still produce enough document
// height for the bottom reserve to actually be realized — without
// it, a one-card page can collapse to its content and pb has nothing
// to push against on some browsers.
//
// IMPORTANT: this lived in webui/client/src/theme/index.js until
// 2026-04-19, but that file was orphan code (never imported into
// the runtime ThemeProvider). Moved here so it actually loads.
const cssBaselineOverrides = {
  styleOverrides: {
    'html, body, #root': {
      height: '100%',
    },
    main: {
      minHeight: '100%',
      scrollPaddingBottom: 'var(--mobile-nav-offset, 0px)',
    },
    '[data-scroll-container]': {
      scrollPaddingBottom: 'var(--mobile-nav-offset, 0px)',
      paddingBottom: 'var(--mobile-nav-offset, 0px)',
      WebkitOverflowScrolling: 'touch',
    },
    '[data-page-root]': {
      paddingBottom: 'var(--mobile-nav-offset, 0px)',
    },
  },
}

// ── Theme-specific glass/glow tokens ─────────────────────────────────
// Phase 4.6: extracted to ../theme/designTokens.js. Re-exported here
// under the original local names so the existing createTheme() blocks
// below keep working without further edits.
const lightGlass = lightGlassTokens
const darkGlass  = darkGlassTokens

// Light theme - clean professional with indigo accents
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5C6AC4',
      light: '#7C8AFF',
      dark: '#4959BD',
    },
    secondary: {
      main: '#7C3AED',
      light: '#A78BFA',
      dark: '#6D28D9',
    },
    background: {
      default: '#F8F9FC',
      paper: '#ffffff',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
    success: { main: '#10B981' },
    warning: { main: '#F59E0B' },
    error: { main: '#EF4444' },
    accent: { main: '#F97316', light: '#FB923C', dark: '#EA580C', contrastText: '#fff' },
  },
  typography: typographyScale,
  shape: { borderRadius: 12 },
  custom: {
    monoFontFamily,
    ...designTokens,
    glass: lightGlass,
  },
  components: {
    MuiCssBaseline: cssBaselineOverrides,
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
          fontSize: '0.8125rem',
          letterSpacing: '0.01em',
        },
        contained: {
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(92, 106, 196, 0.3)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': { borderWidth: 1.5 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...glassCard,
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
          border: '1px solid rgba(0, 0, 0, 0.06)',
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
          '&:hover': {
            borderColor: 'rgba(92, 106, 196, 0.15)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          color: '#1E293B',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8, fontSize: '0.75rem' },
        sizeSmall: { height: 24, fontSize: '0.6875rem' },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(92, 106, 196, 0.1)',
        },
        bar: {
          borderRadius: 3,
          background: 'linear-gradient(90deg, #5C6AC4, #7C3AED)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          minHeight: 42,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(30, 41, 59, 0.92)',
          backdropFilter: 'blur(8px)',
          borderRadius: 8,
          fontSize: '0.75rem',
          padding: '6px 12px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontSize: '0.8125rem',
          border: '1px solid',
        },
      },
    },
  },
})

// Dark theme - deep navy glassmorphism
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7C8AFF',
      light: '#A5B0FF',
      dark: '#5C6AC4',
    },
    secondary: {
      main: '#A78BFA',
      light: '#C4B5FD',
      dark: '#7C3AED',
    },
    background: {
      default: '#111827',
      paper: '#1A2035',
    },
    text: {
      primary: '#E4E4E7',
      secondary: '#A1A1AA',
    },
    success: { main: '#34D399' },
    warning: { main: '#FBBF24' },
    error: { main: '#F87171' },
    accent: { main: '#FB923C', light: '#FDBA74', dark: '#F97316', contrastText: '#fff' },
  },
  typography: typographyScale,
  shape: { borderRadius: 12 },
  custom: {
    monoFontFamily,
    ...designTokens,
    glass: darkGlass,
  },
  components: {
    MuiCssBaseline: cssBaselineOverrides,
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 20px',
          fontSize: '0.8125rem',
          letterSpacing: '0.01em',
        },
        contained: {
          boxShadow: 'none',
          transition: 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(124, 138, 255, 0.3)',
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderWidth: 1.5,
          '&:hover': { borderWidth: 1.5 },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: 44,
          minHeight: 44,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          ...glassCard,
          backgroundColor: 'rgba(26, 32, 53, 0.7)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(124, 138, 255, 0.08)',
          transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
          '&:hover': {
            borderColor: 'rgba(124, 138, 255, 0.18)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(17, 24, 39, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(124, 138, 255, 0.06)',
          borderBottom: '1px solid rgba(124, 138, 255, 0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8, fontSize: '0.75rem' },
        sizeSmall: { height: 24, fontSize: '0.6875rem' },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': { borderColor: 'rgba(124, 138, 255, 0.15)' },
            '&:hover fieldset': { borderColor: 'rgba(124, 138, 255, 0.3)' },
          },
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: '1px solid rgba(124, 138, 255, 0.08)',
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(26, 32, 53, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(124, 138, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(124, 138, 255, 0.1)',
        },
        bar: {
          borderRadius: 3,
          background: 'linear-gradient(90deg, #7C8AFF, #A78BFA)',
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.8125rem',
          minHeight: 42,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(26, 32, 53, 0.92)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(124, 138, 255, 0.1)',
          borderRadius: 8,
          fontSize: '0.75rem',
          padding: '6px 12px',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          fontSize: '0.8125rem',
          border: '1px solid',
        },
      },
    },
  },
})

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('theme-mode')
    return saved || 'light'
  })

  useEffect(() => {
    localStorage.setItem('theme-mode', mode)

    // Update body background and class based on theme
    if (mode === 'dark') {
      document.body.style.background = [
        'radial-gradient(ellipse 80% 60% at 15% 20%, rgba(99, 102, 241, 0.06), transparent 50%)',
        'radial-gradient(ellipse 70% 50% at 85% 80%, rgba(124, 58, 237, 0.04), transparent 50%)',
        'linear-gradient(135deg, #0B0F19 0%, #111827 50%, #0F172A 100%)',
      ].join(', ')
      document.body.classList.remove('theme-light')
      document.body.classList.add('theme-dark')
    } else {
      document.body.style.background = [
        'radial-gradient(ellipse 80% 60% at 15% 20%, rgba(92, 106, 196, 0.05), transparent 50%)',
        'radial-gradient(ellipse 70% 50% at 85% 80%, rgba(124, 58, 237, 0.03), transparent 50%)',
        'linear-gradient(135deg, #F0F2F8 0%, #F8F9FC 50%, #EEF0F6 100%)',
      ].join(', ')
      document.body.classList.remove('theme-dark')
      document.body.classList.add('theme-light')
    }
  }, [mode])

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light')
  }

  const theme = useMemo(() => mode === 'light' ? lightTheme : darkTheme, [mode])

  const value = {
    mode,
    toggleTheme,
    isDark: mode === 'dark',
  }

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={buildGlobalStyles(theme)} />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}

export function useThemeMode() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }
  return context
}

export default ThemeContext
