import { useState } from 'react'
import {
  PanelRenderer,
  useAtdlFormState,
  mapControlValuesToParameters,
  emitStrategyParametersGrp,
  collectRuleRows,
  type AtdlStrategyDto,
  type FixTag,
} from '@fix-portal/fixatdl-react'
// The strategy is the repo's own test fixture, imported rather than copied: the
// suite renders this exact file (src/participateSample.test.tsx), so a change that
// breaks the sample fails the build instead of greeting the next evaluator.
import participate from '../../../src/__fixtures__/participate-strategy.json'
import { useTheme } from './theme'
import { ThemeSelect } from './ThemeSelect'

const strategy = participate as unknown as AtdlStrategyDto

function FixPreview({ tags, error }: { tags: FixTag[]; error: string | null }) {
  if (error != null) return <p className="wb-alert" role="alert">{error}</p>
  if (tags.length === 0) {
    return <p className="wb-note">No parameters are filled, so no group is emitted.</p>
  }
  const count = tags[0].value
  return (
    <table className="wb-table">
      <caption className="wb-note">957 = {count} parameter{count === '1' ? '' : 's'}</caption>
      <thead>
        <tr><th scope="col">958 name</th><th scope="col">959 type</th><th scope="col">960 value</th></tr>
      </thead>
      <tbody>
        {toRows(tags).map(row => (
          <tr key={row.name}>
            <td>{row.name}</td>
            <td>{row.typeCode}</td>
            <td className="wb-wire">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Groups the flat 957-960 tag sequence into one row per parameter for display. */
function toRows(tags: FixTag[]): { name: string; typeCode: string; value: string }[] {
  const rows: { name: string; typeCode: string; value: string }[] = []
  for (let i = 0; i < tags.length; i++) {
    if (tags[i].tag !== 958) continue
    rows.push({ name: tags[i].value, typeCode: tags[i + 1].value, value: tags[i + 2].value })
  }
  return rows
}

export function App() {
  const [theme, setTheme] = useTheme()
  const [highlightedControlId, setHighlightedControlId] = useState<string | null>(null)

  // `clock` is the host's time source. The library never reads a static clock, so
  // a host can drive it from a session clock, a replay, or a test.
  const { values, setValue, controlState, hasErrors, strategyErrors } =
    useAtdlFormState(strategy, { clock: () => new Date() })

  // The preview is derived on every render rather than held in state: the tags are a
  // pure function of the form values, and a second copy of them could only be wrong.
  const parameters = mapControlValuesToParameters(strategy, values)
  let preview: FixTag[] = []
  let previewError: string | null = null
  try {
    preview = emitStrategyParametersGrp(strategy, parameters)
  } catch (error) {
    // emitStrategyParametersGrp throws when a parameter name or wire value carries
    // the FIX delimiter. A preview pane is exactly where a host catches that.
    previewError = error instanceof Error ? error.message : String(error)
  }
  const rules = collectRuleRows(strategy, values)

  return (
    <div className="wb">
      <header className="wb-header">
        <div>
          <h1>{strategy.name}</h1>
          <p className="wb-subtitle">{strategy.description}</p>
        </div>
        <ThemeSelect value={theme} onChange={setTheme} />
      </header>

      <main className="wb-columns">
        <section className="wb-panel" aria-labelledby="wb-form-heading">
          <h2 id="wb-form-heading">Strategy form</h2>
          {strategyErrors.length > 0 && (
            <ul className="wb-alert" role="alert">
              {strategyErrors.map((error, index) => <li key={index}>{error}</li>)}
            </ul>
          )}
          <PanelRenderer
            panel={strategy.panel}
            values={values}
            setValue={setValue}
            state={controlState}
            highlightedControlId={highlightedControlId}
            onHighlightControl={setHighlightedControlId}
          />
        </section>

        <div className="wb-side">
          <section className="wb-panel" aria-labelledby="wb-fix-heading">
            <h2 id="wb-fix-heading">FIX preview</h2>
            <p className="wb-note">
              StrategyParametersGrp, tags 957-960. Only filled parameters appear, and the
              count in 957 is emitted before the repeating group.
            </p>
            <FixPreview tags={preview} error={previewError} />
            <p className={hasErrors ? 'wb-alert' : 'wb-ok'} role="status">
              {hasErrors
                ? 'The form has errors. A host must not submit this preview.'
                : 'The form is valid.'}
            </p>
          </section>

          <section className="wb-panel" aria-labelledby="wb-rules-heading">
            <h2 id="wb-rules-heading">State rules</h2>
            <p className="wb-note">
              Each rule with its condition in words and whether it is firing right now.
              The &quot;why?&quot; button beside a disabled or hidden control highlights it here.
            </p>
            <ul className="wb-rules">
              {rules.map((rule, index) => (
                <li
                  key={index}
                  className={rule.controlId === highlightedControlId ? 'wb-rule wb-rule-on' : 'wb-rule'}
                >
                  <span className="wb-rule-head">
                    {rule.controlLabel} &rarr; {rule.effect} = {String(rule.targetValue)}
                  </span>
                  <span className="wb-wire">{rule.conditionText}</span>
                  <span className={rule.firing ? 'wb-firing' : 'wb-note'}>
                    {rule.firing ? 'firing' : 'not firing'}
                  </span>
                </li>
              ))}
            </ul>
            {highlightedControlId != null && (
              <button type="button" onClick={() => setHighlightedControlId(null)}>
                Clear highlight
              </button>
            )}
          </section>
        </div>
      </main>

      <footer className="wb-footer">
        <p className="wb-note">
          Synthetic strategy from the fictional provider DEMO. It is not a broker
          specification and is not tradeable anywhere. The package renders a strategy
          DTO; obtaining, parsing and validating the broker XML stays with the host and
          its backend.
        </p>
      </footer>
    </div>
  )
}
