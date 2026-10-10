# Hallmark audit

Date: 2026-10-10
Target: Ovelo web application (`apps/web/src`, shared stylesheet, and generated public HTML)

## Findings before the fix

### Critical

- **The 3-column feature grid** — `apps/web/src/styles/index.css:473-514` and `apps/web/src/pages/Landing.tsx:131-155`. Three equal feature tiles were the most recognizable generated-layout pattern. **Fixed:** the first feature now establishes the section across the full measure and the remaining two use unequal tracks.
- **Floating-orb decoration** — `apps/web/src/pages/Landing.tsx:50-52` and the matching CSS. The landing hero used generic orbit decoration without semantic meaning. **Fixed:** removed the orbs and retained the concrete inventory preview.
- **Invented demo metrics** — `apps/web/src/pages/Landing.tsx:60-103`. The marketing preview presented unsourced item/warranty counts as product facts. **Fixed:** copy now identifies illustrative sample records and describes the record contents without fabricated counts.
- **Mid-render font/color improvisation** — `apps/web/src/styles/index.css` contained repeated hard-coded font-family declarations and one-off surface colors outside the token block. **Fixed for typography and primary interaction colors:** body/display/mono families and key interaction colors now use named root tokens.

### Major

- **Eyebrow on every section** — landing, auth, dashboard, generic workspace, and profile headers repeated decorative all-caps labels. **Fixed:** removed decorative labels where they did not communicate a real section/chapter; functional labels remain where they clarify data.
- **Decorative gradient/halo surfaces** — onboarding, auth, admin-login, inventory art, and detail art used ornamental gradients or orbit glows. **Fixed:** replaced the non-semantic gradients with quiet tokenized surfaces; loading shimmer remains because it communicates loading state.
- **Unscoped motion** — buttons and cards used broad transitions and hover lift. **Fixed:** transitions name the affected properties, hover lift was removed from item cards, and active feedback is a single 1px press signal.
- **Responsive safeguards** — the root did not clip horizontal overflow and clickable labels were not globally protected from wrapping. **Fixed:** `html`/`body` use `overflow-x: clip`, display headings allow emergency long-word breaks, and interactive labels use `white-space: nowrap` with mobile containers reflowing.

### Minor

- **Generated public shell drift** — the static HTML generator still carried the old decorative eyebrow/numbered feature copy. **Fixed:** generated public pages now match the simplified runtime landing/public structure.
- **Focus/input polish** — input focus used a transitioning shadow ring. **Fixed:** focus geometry is reserved at rest, state transitions are limited to color properties, and active/focus-visible styles remain immediate.

## Post-fix gate review

- No purple/blue or gradient headline, no fake browser/phone/IDE chrome, no emoji feature icons, no Lottie/Three.js shortcut, and no centered full-viewport hero.
- The landing feature structure is asymmetric rather than three equal tiles.
- `html` and `body` clip horizontal overflow; responsive widths remain part of the verification checklist.
- Button/input disabled, active, and focus-visible states remain implemented by the existing shared components and stylesheet.
- Reduced-motion fallback remains present for the existing spinner/shimmer/slide transitions.
- Full browser viewport audit was unavailable in this checkout because the prior temporary Playwright harness is not present and Playwright is not a project dependency. Typecheck, lint, production build, generated-page build, and static/root tests are the available verification.

## Summary

`4 critical · 4 major · 2 minor` findings before the fix. The critical and major findings above were fixed in place; no routes or application behavior were changed.
