import { THEMES, type Theme } from './theme'

export function ThemeSelect({ value, onChange }: { value: Theme; onChange(next: Theme): void }) {
  return (
    <label className="wb-theme">
      Theme
      <select value={value} onChange={event => onChange(event.target.value as Theme)}>
        {THEMES.map(theme => (
          <option key={theme} value={theme}>
            {theme[0].toUpperCase() + theme.slice(1)}
          </option>
        ))}
      </select>
    </label>
  )
}
