import type { ComponentType } from 'react'
import type { AtdlControlDto } from '../types'
import type { ControlFormState } from '../useAtdlFormState'

// ---------------------------------------------------------------------------
// Shared prop contract for all control renderers
// ---------------------------------------------------------------------------

// WHY: re-exporting ControlFormState under the name ControlState keeps the
// renderer-facing API stable even if the hook's type evolves internally.
export type { ControlFormState as ControlState }

export interface ControlProps {
  control: AtdlControlDto
  value: unknown
  onChange(next: unknown): void
  state: ControlFormState
  radioGroupName?: string
}

// ---------------------------------------------------------------------------
// Registry - keyed by the FIXatdl xsi:type discriminator string (with _t suffix)
// so AtdlControlDto.type maps 1:1 with no normalisation step needed at dispatch.
// ---------------------------------------------------------------------------

// WHY: imported lazily via the index to avoid circular deps; each component
// module imports controlRegistry's *types* only, not the registry object.
import { TextFieldControl } from './TextFieldControl'
import { NumericFieldControl } from './NumericFieldControl'
import { DropDownControl } from './DropDownControl'
import { CheckBoxControl } from './CheckBoxControl'
import { RadioListControl } from './RadioListControl'
import { LabelControl } from './LabelControl'
import { EditableDropDownControl } from './EditableDropDownControl'
import { ClockControl } from './ClockControl'
import { SliderControl } from './SliderControl'
import { MultiSelectControl } from './MultiSelectControl'
import { CheckBoxListControl } from './CheckBoxListControl'

export const controlRegistry: Record<string, ComponentType<ControlProps>> = {
  TextField_t: TextFieldControl,
  // Both spinner variants produce a numeric input.
  // DoubleSpinner additionally exposes its authored outer increment.
  DoubleSpinner_t: NumericFieldControl,
  SingleSpinner_t: NumericFieldControl,
  // DropDownList and SingleSelectList both render as a <select>; the
  // multi-select variant is T22's MultipleSelectList_t.
  DropDownList_t: DropDownControl,
  SingleSelectList_t: DropDownControl,
  CheckBox_t: CheckBoxControl,
  RadioButton_t: CheckBoxControl,
  RadioButtonList_t: RadioListControl,
  Label_t: LabelControl,
  HiddenField_t: () => null,
  // T22 batch 2 - interactive controls
  EditableDropDownList_t: EditableDropDownControl,
  Clock_t: ClockControl,
  Slider_t: SliderControl,
  MultiSelectList_t: MultiSelectControl,
  // WHY: CheckBoxList_t and MultiSelectList_t have identical UX (ordered list
  // of checkboxes producing an array of enumIds). Both map to MultiSelectControl
  // via the re-export alias. If a distinct visual treatment is ever needed for
  // one of them, replace the alias import with its own implementation.
  CheckBoxList_t: CheckBoxListControl,
}
