import type { StateRuleAstNode } from './stateRuleAst'
import { MAX_STATE_RULE_DEPTH } from './stateRuleAst'

export interface TreeLine {
  depth: number
  text: string
  isOperator: boolean
}

function formatValue(value: unknown): string {
  return typeof value === 'number' ? String(value) : `"${String(value)}"`
}

function compareText(node: Extract<StateRuleAstNode, { kind: 'compare' }>): string {
  if (node.operator === 'exists') return `${node.field} exists`
  if (node.operator === 'not-exists') return `${node.field} not exists`
  return `${node.field} ${node.operator} ${node.field2 ?? formatValue(node.value)}`
}

// WHY parenthesise: compound children (and/or/xor) need parens for unambiguous
// reading; comparisons and NOT are already self-delimiting.
function wrap(node: StateRuleAstNode, depth: number): string {
  const text = stateRuleToText(node, depth)
  return node.kind === 'compare' || node.kind === 'not' ? text : `(${text})`
}

export function stateRuleToText(node: StateRuleAstNode, depth = 0): string {
  if (depth > MAX_STATE_RULE_DEPTH) return '(nested too deep)'
  if (!node || (node.kind !== 'compare' && !Array.isArray(node.children))) return '(invalid rule)'
  switch (node.kind) {
    case 'compare':
      return compareText(node)
    case 'and':
      return node.children.map(c => wrap(c, depth + 1)).join(' AND ')
    case 'or':
      return node.children.map(c => wrap(c, depth + 1)).join(' OR ')
    case 'xor':
      return node.children.map(c => wrap(c, depth + 1)).join(' XOR ')
    case 'not':
      return `NOT (${stateRuleToText(node.children[0], depth + 1)})`
    default: return '(invalid rule)'
  }
}

export function stateRuleToTree(node: StateRuleAstNode, depth = 0, into: TreeLine[] = []): TreeLine[] {
  if (depth > MAX_STATE_RULE_DEPTH) {
    into.push({ depth, text: '...', isOperator: false })
    return into
  }
  if (!node || (node.kind !== 'compare' && !Array.isArray(node.children))) {
    into.push({ depth, text: '(invalid rule)', isOperator: false })
    return into
  }
  if (node.kind === 'compare') {
    into.push({ depth, text: compareText(node), isOperator: false })
    return into
  }
  into.push({ depth, text: node.kind.toUpperCase(), isOperator: true })
  for (const child of node.children) stateRuleToTree(child, depth + 1, into)
  return into
}
