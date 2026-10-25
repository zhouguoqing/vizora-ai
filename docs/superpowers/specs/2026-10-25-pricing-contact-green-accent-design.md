# Pricing and Contact Green Accent Design

## Goal

Align the public pricing and contact form typography with the light site's green theme, including the items marked in the supplied screenshots and supporting copy in those same areas.

## Design

- Use the existing public-site theme green (`#087e69`) for pricing card descriptions, price notes, and benefit lists, plus the billing toggle's labels and discount text.
- Use the same green for contact form field labels, consent copy, and the introductory supporting paragraph.
- Render the annual `约 8 折` badge with a green background and white text for legibility.
- Keep headings, prices, primary actions, status/error messages, and unrelated page content under their existing styles. Preserve layout, interactions, and responsive behavior.
- Implement with narrowly scoped public-site CSS selectors, reusing the existing theme token rather than changing global colors or business logic.

## Validation

Run the focused public-site frontend tests and production build. Confirm the selectors apply only to the public pricing/contact surfaces and preserve contrast for the annual discount badge.
