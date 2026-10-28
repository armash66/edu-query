import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
}

const STORAGE_KEY = 'eduquery_theme'
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getStoredTheme(): ThemePreference {
  try {
    const val = localStorage.getItem(STORAGE_KEY)
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val
    }
  } catch {
    // Graceful fallback if storage unavailable
  }
  return 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemePreference>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  // Listen to OS theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [])

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') return systemTheme
    return theme
  }, [theme, systemTheme])

  // Apply to DOM & persist
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', resolvedTheme)
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Non-blocking
    }
  }, [theme, resolvedTheme])

  const setTheme = (newTheme: ThemePreference) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
