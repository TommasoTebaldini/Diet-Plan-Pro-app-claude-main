import { createContext, useContext, useEffect, useState } from 'react'

const AppSettingsContext = createContext({})

const STORAGE_KEY = 'nutriplan_app_settings'

const defaults = {
  darkMode: false,
  highContrast: false,
  textSize: 'normal', // 'normal' | 'large' | 'xlarge'
  language: 'it',
}

function loadSettings() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return defaults
  }
}

function applyToDOM(settings) {
  const html = document.documentElement
  html.classList.toggle('dark', settings.darkMode)
  html.classList.toggle('high-contrast', settings.highContrast)
  html.classList.remove('text-large', 'text-xlarge')
  if (settings.textSize === 'large') html.classList.add('text-large')
  if (settings.textSize === 'xlarge') html.classList.add('text-xlarge')

  // Update theme-color meta for dark mode
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = settings.darkMode ? '#0d1a12' : '#1a7f5a'
}

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    applyToDOM(settings)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  // Apply on mount from saved prefs
  useEffect(() => {
    applyToDOM(settings)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function update(patch) {
    setSettings(s => ({ ...s, ...patch }))
  }

  return (
    <AppSettingsContext.Provider value={{ settings, update }}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export const useAppSettings = () => useContext(AppSettingsContext)
