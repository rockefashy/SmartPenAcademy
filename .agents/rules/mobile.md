# Mobile-First UI Rules

These rules apply to all UI work in this project — new components, new forms,
new modals, new pages, and edits to existing ones. Follow them by default;
do not wait to be reminded.

This file governs UI/mobile implementation. For architecture, security, data
model, and API rules, see `GEMINI.md` — that file is
authoritative for anything outside UI/mobile scope. Where this file
authorizes cross-cutting UI work (shared-component extraction and migration
across many call sites), that work is explicitly exempted from `GEMINI.md`
Section 28's "do not refactor unrelated code" rule — see the note there.

## Layout & Viewport

- Never use raw `vh` units for any element affected by mobile keyboard or
  browser chrome (modals, full-height containers, docked panels). Use `dvh`
  with a `vh` fallback, or use the shared `<Modal>` component, which already
  handles this.
- Any table or data grid must have an explicit mobile behavior decided at
  build time: horizontal scroll, card/list view, or column-priority hiding.
  Do not ship a table without deciding this.

## Touch & Input

- Minimum touch target: 44x44px on every interactive element — buttons,
  checkboxes, radios, and any link acting as a button.
- Minimum font size on any text input: 16px (`text-base` or larger on
  mobile breakpoints). Smaller sizes trigger forced auto-zoom on iOS Safari.

## Shared Components — Use Them, Don't Re-implement Them

- All modals/overlays must use the shared `<Modal>` component
  (`src/components/ui/Modal.tsx`). Never hand-roll `fixed inset-0` markup.
- All buttons must use the shared `<Button>` component
  (`src/components/ui/Button.tsx`). Never write a raw `<button>` with ad hoc
  classes.
- All form inputs must use the shared `<FormField>` / `<Input>` /
  `<Select>` / `<Textarea>` components (`src/components/ui/FormField.tsx`).
  Never write raw `<input>`, `<select>`, or `<textarea>` markup.
- If a new UI pattern doesn't fit an existing shared component, extract a
  new shared component before writing the second instance of that pattern —
  not after the third. Duplication is the default failure mode to avoid.
  This extraction work is pre-authorized; no separate approval is needed to
  create a new `src/components/ui/` primitive when a pattern repeats.

## Verification Before Reporting Complete

- Any change touching forms, modals, or keyboard input must be verified on
  a real mobile device (or a confirmed-working device-emulation path)
  before being reported as done. A passing `lint`/`build` is necessary but
  not sufficient — it does not verify mobile layout or keyboard behavior.
- If real-device verification did not happen for a given change, say so
  explicitly in the completion report rather than omitting it. Do not
  report a UI task as complete on the strength of a clean build alone.
- This mirrors `GEMINI.md` Section 25 (Evidence-Based Implementation Rule)
  and Section 32's IMPLEMENTED / PARTIALLY IMPLEMENTED / NOT IMPLEMENTED /
  NOT VERIFIED reporting vocabulary — use that vocabulary for UI/mobile
  status reports too, not just security/architecture ones.

## Why This File Exists

This project doubles as a reference template for future builds. Keep this
file generic enough to carry forward as-is into new projects, and note here
which shared components fulfill each rule so a future build can reuse them
directly or use them as a reference implementation:

- Viewport/keyboard handling -> `src/components/ui/Modal.tsx`
- Touch target + font size baseline -> `src/components/ui/Button.tsx`,
  `src/components/ui/FormField.tsx`
