# Pricing and Contact Green Accent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pricing and contact supporting text use the site's green theme, and give the annual discount badge a green background.

**Architecture:** Keep the change in shared public-site CSS, scoped to existing pricing and contact components so the independent V2 homepage and unrelated routes are unaffected. Verify the existing public-site unit coverage for the shared-theme routing contract; validate selectors and contrast through CSS review and production build.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vite, CSS.

---

### Task 1: Apply green text styling to pricing and contact surfaces

**Files:**
- Modify: `web/src/v3-public.css`
- Verify: `web/src/public-site.test.ts`

- [ ] **Step 1: Verify the existing route-scope assertion**

In `web/src/public-site.test.ts`, confirm the existing test already asserts `/contact` and `/pricing` use the shared green theme and `/home-v2` remains outside it. Do not add duplicate route assertions.

- [ ] **Step 2: Run the focused test**

Run from `web/`: `npm test -- src/public-site.test.ts`

Expected: PASS, confirming the route scope before CSS changes.

- [ ] **Step 3: Update scoped public-site CSS**

In `web/src/v3-public.css`, use `#087e69` for:
- `.v3-public .plan .description`, `.v3-public .plan .price-note`, and `.v3-public .plan ul` text.
- Inactive `.v3-public .pricing-controls .billing-toggle button:not(.active)` text and `.v3-public .discount` text; preserve white text on the active green toggle for contrast.
- `.v3-public .contact-layout .form > label` and `.v3-public .contact-layout > .tile:first-child > p`.

Give `.v3-public .discount` a `#087e69` background and white text. Keep plan headings/prices, primary buttons, alerts, placeholders, page layout, and `main.v3-public` scoping unchanged. Add selectors near the existing pricing/contact theme rules.

- [ ] **Step 4: Run focused tests and production build**

Run from `web/`:

```bash
npm test -- src/public-site.test.ts
npm run build
```

Expected: Vitest passes and `vue-tsc -b && vite build` completes successfully.

- [ ] **Step 5: Review the diff**

Run `git diff --check` and inspect the `v3-public.css` diff to confirm the styles are scoped to the shared public pages and that white text remains on the green discount badge.
