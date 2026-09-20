import type { AtdlEnumPairDto, AtdlListItemDto } from '../types'

interface ListOptionSource {
  listItems?: AtdlListItemDto[] | null
  parameter?: { enumValues?: AtdlEnumPairDto[] | null } | null
}

export interface ListOption {
  enumId: string
  label: string
}

export function listOptionsFor(control: ListOptionSource): ListOption[] {
  if (control.listItems?.length) return control.listItems.map(item => ({ enumId: item.enumId, label: item.uiRep ?? item.enumId }))
  return (control.parameter?.enumValues ?? []).map(item => ({ enumId: item.enumId, label: item.enumId }))
}
