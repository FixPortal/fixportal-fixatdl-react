// CheckBoxListControl is currently visually identical to MultiSelectControl -
// both render an ordered list of checkboxes producing an array of enum ids.
// The FIXatdl spec distinguishes CheckBoxList_t from MultiSelectList_t, but
// the UX is the same at this point in the product. If a future design
// requires a chip-list or inline presentation for one of them, replace this
// re-export with its own implementation.
export { MultiSelectControl as CheckBoxListControl } from './MultiSelectControl'
