/**
 * StateRule AST types for the TypeScript evaluator.
 *
 * WHY: The discriminated-union shape gives the TS compiler full narrowing so
 * every `switch (node.kind)` is exhaustive-checked.  The C# side uses the same
 * string literals for Kind and Operator so the JSON produced by the backend
 * passes through without any remapping.
 */

export type StateRuleAstNode =
  | { kind: 'compare'; operator: StateRuleOperator; field: string; field2?: string | null; comparisonType?: string | null; value: unknown; children?: null }
  | { kind: 'and'; children: StateRuleAstNode[] }
  | { kind: 'or'; children: StateRuleAstNode[] }
  | { kind: 'not'; children: [StateRuleAstNode] }
  | { kind: 'xor'; children: StateRuleAstNode[] }

export type StateRuleOperator =
  | '=='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'exists'
  | 'not-exists'
