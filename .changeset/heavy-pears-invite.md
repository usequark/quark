---
"@usequark/quark-create-app": patch
---

Route `FormField`'s `className` to the control and put error ARIA where a
screen reader can reach it.

Two independent bugs in `packages/ui/src/form-field.js`, both measured by
rendering the component under jsdom and dumping the resulting DOM.

`className` was interpolated onto the layout `<div>`, so a caller could not
style the input. Every sibling component in the package (`Input`, `Textarea`,
`Select`, `Card`, …) appends `className` to its own root element, which is what
the prop means everywhere else. Measured before: `className` present on the
wrapper, absent from the `<input>`. The prop was effectively useless for its
documented purpose.

`aria-invalid` and `aria-describedby` were placed on a plain wrapper `<div>`
around caller-supplied children. Those attributes have no effect on a
non-interactive element, so when `FormField` was given a `<Textarea>` or
`Select` child the error was never associated with the control a screen reader
is actually sitting on. Measured before: both attributes on the wrapper
`<div>`, and `null` on the `<textarea>`. The default `<Input>` path was already
correct, which is why the existing test passed — it asserted against the wrapper
rather than the control.

`className` now applies to the control, matching the rest of the package, and a
new `wrapperClassName` prop styles the layout container for anyone who was
relying on the old behaviour. The error association is cloned onto a custom
child so explicit props on that child still win.

Six tests added to `form-field.integration-test.js`, including a guard that no
`div[aria-invalid]` survives in the DOM. Verified to fail 2 of 10 when the old
wrapper behaviour is restored.