import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

export const THEMES: Theme[] = ['system', 'light', 'dark']

/**
 * Writes the chosen theme to `data-theme` on <html>. The package's stylesheet
 * defines the ten design tokens at their light defaults; workbench.css redefines
 * those same ten under `[data-theme="dark"]` and under the system preference.
 * Nothing here touches a control's class names -- re-theming a FIXatdl form is
 * entirely a matter of redeclaring custom properties.
 *
 * This hook lives apart from ThemeSelect because react-refresh/only-export-components
 * makes a module that exports both a component and a non-component an error.
 */
/**
 * `?theme=light` / `?theme=dark` seeds the initial choice. The selector still works
 * normally afterwards; the parameter exists so scripts/capture-screenshot.mjs can put
 * the same form in both themes side by side without driving the widget.
 */
function seedTheme(): Theme {
  const requested = new URLSearchParams(window.location.search).get('theme')
  return THEMES.includes(requested as Theme) ? (requested as Theme) : 'system'
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(seedTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  return [theme, setTheme]
}
