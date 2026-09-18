import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The package's own optional stylesheet: every utility class the controls emit,
// plus the ten design tokens at their documented default values. Nothing in this
// sample restyles a control -- workbench.css only themes the page around them and
// redefines those ten tokens for dark mode.
import '@fix-portal/fixatdl-react/styles.css'
import './workbench.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
