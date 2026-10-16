import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const message = 'Do not use dangerouslySetInnerHTML. Render untrusted content as React children.'

function lint(source) {
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/eslint/bin/eslint.js'),
      '--stdin',
      '--stdin-filename',
      resolve('src/controls/LabelControl.tsx'),
      '--format',
      'json',
    ],
    { input: source, encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 },
  )
  expect(result.error).toBeUndefined()
  expect(result.signal).toBeNull()
  const reports = JSON.parse(result.stdout)
  expect(reports).toHaveLength(1)
  expect(reports[0].fatalErrorCount).toBe(0)
  expect(reports[0].messages.every((item) => item.ruleId !== null)).toBe(true)
  return { status: result.status, report: reports[0] }
}

describe('actual production JSX lint boundary', () => {
  it('rejects raw HTML through the exact preventative selector diagnostic', () => {
    const result = lint(
      "export function HtmlProbe() { return <div dangerouslySetInnerHTML={{ __html: '<img src=x onerror=alert(1)>' }} /> }",
    )
    expect(result.report.messages).toContainEqual(
      expect.objectContaining({ ruleId: 'no-restricted-syntax', severity: 2, message }),
    )
    expect(result.report.messages.filter((item) => item.message === message)).toHaveLength(1)
    expect(result.status).toBe(1)
  }, 35_000)

  it('accepts the same hostile string rendered as React children', () => {
    const result = lint(
      "export function HtmlProbe() { return <div>{'<img src=x onerror=alert(1)>'}</div> }",
    )
    expect(result.report.messages).not.toContainEqual(expect.objectContaining({ message }))
    expect(result.report.errorCount).toBe(0)
    expect(result.status).toBe(0)
  }, 35_000)
})
