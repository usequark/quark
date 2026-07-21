---
name: accessibility
description: WCAG 2.2 compliance review, ARIA patterns, inclusive design, and screen reader compatibility
---

Review content and UI elements against WCAG 2.2 criteria to ensure inclusive, accessible experiences.

## Color Contrast Ratios
- Validate that all text has a contrast ratio of at least 4.5:1 for small text and 3:1 for large text (18px+ bold or 24px+ regular).
- Check non-text elements (icons, focus indicators, borders) against 3:1 minimum.
- Never rely on color alone to convey information (e.g., red/green status indicators must include text or icon labels).
- Suggest specific hex values to fix failing contrast ratios.

## Alt Text Requirements
- Every image must have `alt` text. Decorative images get `alt=""` (empty).
- Informative images: describe the content and function in context - be concise but complete.
- Complex images (charts, graphs): provide a short alt text plus a longer description in nearby text or `aria-describedby`.
- Alt text should not start with "image of" or "picture of" - screen readers announce it as an image automatically.

## Heading Structure
- Headings must follow a logical hierarchy (h1 → h2 → h3) without skipping levels.
- Never use headings purely for visual styling - use CSS for that.
- Verify that all content is sectioned by headings that describe the content beneath them.
- Check that heading levels are consistent across similar pages/templates.

## Keyboard Navigation
- All interactive elements must be reachable and operable via keyboard alone (Tab, Enter, Space, arrow keys).
- Visible focus indicators must be present on every interactive element. Never use `outline: none` without a replacement.
- Tab order must follow the visual/reading order. No positive `tabindex` values (use `tabindex="0"` or `-1` only).
- Skip navigation links must be the first focusable element on the page.

## Common WCAG Failures to Check
- Missing form label associations (every input must have a `<label>` or `aria-label`).
- Buttons vs. links: use `<button>` for actions, `<a>` for navigation - never the reverse.
- Dynamic content changes: updates must be announced by aria-live regions.
- Touch target size: interactive targets must be at least 24x24 CSS pixels with sufficient spacing.
- CAPTCHA failures: offer audio alternatives or accessible challenge methods.
