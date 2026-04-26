# About Page And UX Copy Updates Design

## Goal

Ship five coordinated public-facing improvements:

1. add a standalone `About Us` page,
2. replace Russian-facing `борд` wording with `сетлист` in public UI copy,
3. make the FAQ quick-start phrase link to the latest published setlist,
4. improve past-gig seat presentation and YouTube affordance,
5. return users to their previous page after sign-in.

The result should feel consistent with the existing Jammers visual language, stay easy to extend with more content later, and avoid risky behavioral regressions in auth and event navigation.

## Scope

### In scope

- New public route for `About Us`
- Header navigation entry for `About Us`
- Reusable content structure for:
  - hero image gallery,
  - organizers,
  - contacts,
  - partners with optional image and link
- Russian copy updates from `борд` to `сетлист` in public user-facing surfaces touched by this work
- FAQ heading update and contextual setlist link
- Past-gig lineup rendering update from dots/placeholders to instrument icons only
- Hiding empty slots for already finished gigs
- More explicit YouTube CTA in track rows, including mobile
- Return-to-origin behavior after Telegram and local dev sign-in

### Out of scope

- Admin CMS/editor UI for managing About page content
- Database schema changes
- Renaming internal variables, route segments, or domain concepts from `board` to `setlist`
- Reworking event selection logic beyond choosing a safe destination for the FAQ link
- Full copy rewrite across docs, admin-only flows, and internal technical text

## Current State

- Top navigation currently exposes `Home`, `Setlists`, and `FAQ`.
- The FAQ page contains the phrase `Как влиться и не затормозить борд`.
- Public UI copy mixes `борд` and `сетлист`, especially on the homepage, FAQ, profile, and event pages.
- Published/past gig summaries already exist, but finished lineups still show generic dot-style occupancy patterns rather than instrument-forward summaries.
- Track rows use an `ExternalLink` icon for YouTube search, which is too subtle on mobile.
- Telegram auth already carries a `returnTo` parameter, but the end-to-end return flow is not consistently preserved across all sign-in entry paths.

## Proposed Approach

### 1. Add a content-driven About page

Create a new public page at `/about` that follows the selected Option A direction:

- a cinematic hero section using the provided group photo as the main atmospheric visual,
- a short intro block over or beneath the hero,
- a gallery strip that is designed for one photo now but accepts multiple photos later,
- an organizers section using the provided organizer names,
- a contacts section with explicit placeholder values for later manual editing,
- a partners section that supports partner name, optional image, and optional external URL.

The page should preserve the existing brand mood:

- dark stage-like surfaces,
- strong gold/sand highlights,
- bold uppercase headings where consistent with the rest of the site,
- responsive stacking on mobile.

The content should live in a typed constant/module instead of being hardcoded across the JSX so future edits are localized to one place.

### 2. Make the FAQ phrase link to the latest setlist destination

Update the FAQ quick-start heading so Russian reads `Как влиться и не затормозить сетлист`.

The word `сетлист` should be the clickable portion. Its destination should resolve using this priority:

1. latest published event setlist,
2. if none exists, nearest current event page,
3. if no event is available, homepage published section anchor.

This keeps the copy actionable without creating broken or dead-end links.

### 3. Replace public Russian `борд` copy with `сетлист`

Adjust user-facing Russian strings in the touched public pages/components so `борд` is replaced by `сетлист` where the meaning is "the live event page / working setlist surface".

Guardrails:

- do not rename internal identifiers, route names, file names, or database concepts,
- do not blindly replace English `board`,
- do not alter admin or developer-oriented copy unless it is directly surfaced in the same public UX being updated.

The goal is linguistic consistency in the real user experience, not repository-wide terminology churn.

### 4. Improve finished-gig lineup readability

For already finished/published past gigs, replace generic occupancy dots with instrument icons using the existing role-family icon language where possible.

Behavior:

- show only occupied seats for past gigs,
- hide empty slots entirely,
- preserve readable labels/tooltips so icon-only presentation does not become ambiguous,
- keep layout compact enough for archive cards and mobile widths.

This should make old setlists feel more legible and more musically descriptive at a glance.

### 5. Make the YouTube action explicit

Replace the current subtle external-link affordance in track rows with a clearer YouTube-oriented CTA.

The CTA should:

- still open the YouTube search in a new tab,
- include a stronger icon treatment and visible label on constrained/mobile layouts,
- remain compact enough not to dominate the track controls,
- keep accessible labels and titles in both locales.

The visual intent is "listen / open on YouTube", not "generic external link".

### 6. Finish return-after-login behavior

Preserve the page a user came from when they decide to sign in.

Behavior:

- if a user starts sign-in from a public page, successful sign-in returns them there,
- if sign-in starts on `/profile`, current behavior remains valid,
- Telegram login should continue using safe relative `returnTo` values only,
- local dev login should follow the same `returnTo` logic,
- auth error redirects should preserve a sane fallback and not create loops.

Safety rules:

- only allow relative in-app destinations,
- reject protocol-relative and external URLs,
- preserve relevant query parameters unless they are auth-noise parameters.

## Architecture And File Shape

### Content model

Introduce an About-page content structure in a lib/content module, for example:

- page intro text
- `gallery: Array<{ src: string; alt: string; caption?: string }>`
- `organizers: Array<{ name: string; role?: string; contactLabel?: string; contactValue?: string }>`
- `contacts: Array<{ label: string; value: string; href?: string }>`
- `partners: Array<{ name: string; href?: string; imageSrc?: string; imageAlt?: string }>`

This avoids scattering literal data through JSX and keeps future edits low-risk.

### Rendering

- Add a new page component for `/about`
- Add navigation link in the shared site header
- Reuse existing `Card`, button, and brand utility classes where practical
- Add only the minimum new presentational helpers/components needed for maintainability

### Auth return flow

Unify destination handling around the existing safe relative-path helper behavior so the same rules apply to:

- Telegram POST completion,
- Telegram GET retry redirect,
- local dev sign-in entry/action,
- sign-in links that send guests to `/profile`.

Where a direct deep-link sign-in CTA exists, pass a `returnTo` query explicitly instead of relying only on `/profile`.

## Data Flow

### About page

Static content module -> About page server component -> rendered sections

### FAQ setlist link

Server-side page load -> fetch published/current event summary -> compute safe href -> render linked heading fragment

### Past-gig icons

Existing event/track seat data -> filter occupied seats for past gigs -> map seats to role-family icons -> render compact lineup summary

### Sign-in return

Origin page -> `/profile?returnTo=...` or widget-calculated current path -> auth route/action -> safe destination normalization -> redirect back to origin

## Error Handling

- If the About image asset is unavailable, the page still renders with fallback copy and layout integrity.
- If no published event exists for the FAQ link, use fallback routing rather than disabling the phrase.
- If partner links or images are missing, render the partner as text-only.
- If a return target is invalid, fall back to `/profile`.
- If mobile space is too tight for the full YouTube label, degrade to a shorter but still explicit label/icon combination rather than a generic external-link glyph.

## Testing Strategy

### Automated

- Add/adjust tests for safe return-target normalization
- Add tests for auth redirects where practical
- Add tests for FAQ destination resolution helper if extracted
- Add tests for past-gig lineup summary behavior:
  - occupied seats render,
  - empty seats hidden,
  - instrument/icon mapping remains stable

### Manual smoke checks

- `/about` renders correctly on desktop and mobile
- header nav includes `About Us`
- FAQ heading link opens the expected current setlist destination
- Russian copy no longer uses `борд` in the touched public surfaces
- past published gigs show occupied instrument icons and no empty placeholders
- YouTube CTA is understandable on mobile and desktop
- signing in from an event page returns to that same page
- signing in from FAQ/About/Home returns to the originating page

## Implementation Notes

- The provided image should be added as the first gallery asset and the gallery should be structured for future expansion from day one.
- Organizer contact values should ship as obvious placeholders so they are easy to replace manually later.
- Partner cards should render gracefully with name only for now.
- Copy changes should be reviewed carefully by locale rather than applied as bulk string replacement.

## Risks And Mitigations

### Risk: copy replacements overreach

Mitigation: limit replacements to explicit public-facing Russian strings in touched screens and review each manually.

### Risk: auth return loops or unsafe redirects

Mitigation: centralize/retain strict safe-relative-path checks and test invalid values.

### Risk: About page becomes hard to maintain

Mitigation: keep content in a single typed structure and keep sections modular.

### Risk: mobile CTA clutter in track rows

Mitigation: use a compact but explicit control and verify in the current responsive layout.

## Success Criteria

- Users can open a polished `About Us` page with the provided photo, organizer list, contact placeholders, and partner list.
- The FAQ quick-start phrase uses `сетлист` and links to the most relevant current setlist destination.
- Russian public copy in touched areas no longer says `борд`.
- Past gigs show instrument-driven occupied-seat summaries without empty slots.
- YouTube actions are immediately understandable.
- After login, users land back on the page they came from.
