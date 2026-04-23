# MediSlot Design System

> **Status:** Canonical. Referenced in **MEDI-51** acceptance criteria.
> Every feature PR is expected to read against these rules before review.

---

## 1. Aesthetic direction — "Clinical Quiet"

MediSlot isn't a consumer app and it isn't an EHR. It's a scheduling surface that sits next to medical work, so the design takes its cues from **printed clinical documents and editorial medicine journals**, not SaaS dashboards.

Three things define the look:

- **Ink blue + sage green on warm paper.** The blues are desaturated and low-chroma; the neutrals are warm (hue 80°, not cold 248°). Avoid pure grays — they read as "generic enterprise."
- **Editorial serif for display, Geist for UI, Geist Mono for data.** Newsreader carries page titles, section headers, and empty-state hero lines. Geist does 95% of UI labels. Mono is reserved for **data** — times, IDs, counts, timestamps, coordinates. It is not a decorative font; if the thing isn't data, it's not Mono.
- **Hairline, not floaty.** Shadows are crisp 1px borders + a whisper of depth. No glow, no drop-shadow-2xl, no frosted glass. Corners are 6px by default — sharp enough to feel exacting.

**AI-slop tells we are actively avoiding:** gradient hero backgrounds, rounded-2xl + soft lilac shadow cards, emoji icons, clip-art SVG illustrations, generic "Inter + violet" palettes.

---

## 2. Where things live

```
/frontend/design/
  tokens.css            ← Source of truth. All design tokens as CSS vars.
  tailwind.config.ts    ← Reference only (v3-style). See note below.
  shared.css            ← Component styles used by the reference HTML artifacts.
  DESIGN.md             ← This file.
```

**Import `tokens.css` once**, via `@import "../design/tokens.css";` at the top of `app/globals.css`, before `@import "tailwindcss";`. The Tailwind utilities read from the CSS variables, so dark-mode or theming later is a matter of swapping vars, not rebuilding the scale.

> **Tailwind v4 note.** This project uses Tailwind v4, which replaces `tailwind.config.ts` with a CSS-first `@theme inline { ... }` block. The `tailwind.config.ts` in this folder is retained for reference (and for anyone diffing against the design bundle), but the live wiring between `tokens.css` and Tailwind utilities lives in `app/globals.css`. If you add a new token family, add it to **both** `tokens.css` (the source) **and** the `@theme inline` block in `globals.css` (so utilities like `bg-primary-700` resolve).

### Reference screens (open these before you build anything)

- [Design System](../../Design%20System.html) — the gallery. If you can't find it here, it doesn't exist yet. Ask before inventing.
- [Login](../../Login.html) — covers **all auth screens** (login, forgot password, reset, first-time setup). Split-panel layout, serif quote on the left, form on the right.
- [Patient Browse](../../Patient%20Browse.html) — browse doctors + **booking modal**. Covers the E6 patterns: doctor cards, filter rail, slot picker, confirmation dialog.
- [Doctor Dashboard](../../Doctor%20Dashboard.html) — covers **doctor AND receptionist** dashboards (the receptionist view reuses this shell with a doctor switcher at top-left and "book on behalf of" affordances on each slot).
- [Admin Users](../../Admin%20Users.html) — users table with **bulk select, row actions menu, and edit drawer**. Use this as the reference for every admin CRUD table.

---

## 3. Tokens — usage rules

### 3.1 Color

| Token family | When to use | When **NOT** to use |
|---|---|---|
| `primary-*` (ink blue) | Primary actions, active nav, links, selected slot, admin accents | Decorative backgrounds, body text, large fills |
| `sage-*` | Doctor identity (avatars, schedule blocks), confirmed/booked state | Buttons, links, destructive states |
| `neutral-*` | Text, borders, surfaces, page chrome | Anything carrying semantic meaning |
| `success / warning / danger / info` | Status badges, toasts, validation messages | As a brand color — `primary-*` is the brand |

**Concrete pairings.** Don't invent new ones:

- Page background → `surface-page` (`neutral-0`)
- Cards, modals, dropdowns → `surface-raised` (pure white)
- Disabled / muted panels → `surface-sunken` (`neutral-100`)
- Hover state on neutral surfaces → `neutral-100`
- Default border → `border-DEFAULT`, never `neutral-200` directly
- Body text → `text-body`, headings → `text-primary`, helper text → `text-muted`

**Status badge → token mapping** (all appointment statuses must use these exact pairs):

| Status | bg | border | fg |
|---|---|---|---|
| `BOOKED` | `primary-50` | `primary-200` | `primary-700` |
| `COMPLETED` | `success-bg` | `success-border` | `success-fg` |
| `CANCELLED` | `danger-bg` | `danger-border` | `danger-fg` |
| `PENDING` / `ON_LEAVE` | `warning-bg` | `warning-border` | `warning-fg` |

### 3.2 Typography

| Role | Font | Size / weight | Example |
|---|---|---|---|
| Page title | `font-display` | `text-3xl` / `regular`, with `<em>` in italic | "Today's **schedule**" |
| Section heading | `font-sans` | `text-lg` / `semibold` | "Assigned doctors" |
| Body | `font-sans` | `text-sm` / `regular` | Paragraphs, form labels |
| Eyebrow / micro-label | `font-mono` | `text-2xs` / `medium`, `tracking-widest`, `uppercase` | "PATIENT · ID UP-0421" |
| Data (times, IDs, counts, timestamps) | `font-mono` | size inherits | `09:30` · `148` · `2 min ago` |
| Numeric KPIs | `font-display` | `text-4xl` / `regular` | "**12** appointments today" |

**Rules that are not negotiable:**

1. Never set Mono on narrative text. It's for data only.
2. Display serif is for the *title of the page* and *numeric KPIs*. Don't sprinkle it into buttons or sidebar labels.
3. Minimum UI text size is `text-2xs` (11px) for eyebrows. Nothing smaller.
4. Use `<em>` inside display headings to accent one word per title in italic serif — this is the signature move. One italic word, not three.

### 3.3 Spacing

4px base scale. Use the scale; don't free-type `px-[7px]`.

- Inside a component (button padding, input padding) → `1 – 3` (4–12px)
- Between related elements in a card → `3 – 4` (12–16px)
- Between sections of a page → `8 – 12` (32–48px)
- Page gutter → `layout-gutter` (24px)

### 3.4 Radius

- Inputs, buttons, badges, chips → `rounded-md` (6px) — **the default**
- Cards, modals, drawers → `rounded-lg` (10px)
- Avatars → `rounded-full`
- Status-badge pills and small data tags → `rounded-sm` (4px)
- Never `rounded-2xl` or larger on interactive elements. It reads as consumer-app, not clinical.

### 3.5 Shadow / elevation

Four elevations, use them positionally, not decoratively:

| Level | Use |
|---|---|
| `shadow-xs` | Default card at rest (hairline only) |
| `shadow-sm` | Card on hover |
| `shadow-md` | Popovers, row-action menus |
| `shadow-overlay` | Modals, drawers, toasts |
| `shadow-focus` | Keyboard focus ring — apply on every interactive element |

---

## 4. Components — rules of use

All components exist in [Design System](../../Design%20System.html). Read it. The rules below are the *why* behind what's rendered there.

### Buttons
- **Primary** — one per view. Solid `primary-700`. Use it for the action the page exists to enable ("Book appointment", "Save changes", "Invite user").
- **Secondary** — 1px border, white fill. For alternate confirm actions ("Export CSV" next to "Invite user").
- **Ghost** — for in-row actions, toolbar utilities, "Cancel" in dialogs.
- **Destructive** — solid `danger-solid`. Only for irreversible actions, and **always** behind a confirmation dialog.
- Sizes: `sm` (28px), default (34px), `lg` (40px). Icons always sit on the left unless it's a disclosure arrow.

### Inputs / Select / Textarea
- Height 36px default, 32px `sm`, 44px `lg`.
- `border-strong` at rest; `border-focus` + `shadow-focus` on focus.
- Labels sit above, not as placeholders. Placeholders are example values only.
- Error state: `danger-border` + helper text in `danger-fg` below.

### Card
- `surface-raised`, `shadow-xs`, `rounded-lg`, `1px border-DEFAULT`.
- Padding `5` (20px) for content cards, `4` (16px) for dense list cards.
- Hover on interactive cards: elevate to `shadow-sm`, **don't** change border color.

### Dialog / Modal
- `max-width: 560px` for forms, `max-width: 720px` for review/confirmation dialogs with data tables.
- Backdrop: `oklch(20% 0.04 248 / 0.25)` — tinted ink, not black.
- Primary action bottom-right, cancel to its left, destructive (if any) bottom-left.
- Close "×" top-right, 32px hit target, `text-muted` → `text-body` on hover.

### Table
- Header row: `surface-sunken`, `text-xs`, `font-mono`, `uppercase`, `tracking-wide`, `text-muted`.
- Rows: 48px minimum height, `1px border-DEFAULT` between rows.
- Hover: row background → `neutral-50`.
- Selected: `primary-50` background + 2px `primary-500` left rail.
- Numeric columns right-aligned and `font-mono`.

### Status Badge — `<StatusBadge>`
Exposes exactly these variants: `booked` · `completed` · `cancelled` · `pending` · `neutral`. Do not invent new statuses; route new states to the existing five.

### Toast
- Bottom-right stack, max 3 visible, auto-dismiss at 5s unless it carries an action.
- 4 variants: `success`, `warning`, `danger`, `info`. Icon on left, close on right, action (if any) inline on right.

### Empty state
- Centered in a card or full panel. 1 line of serif display copy + 1 line of body muted + 1 primary button. No illustration.

### Skeleton loader
- `neutral-100` base, 1.4s shimmer animation toward `neutral-150`. Use for table rows and card grids. **Don't** skeleton a whole page — show real chrome and skeleton only the unresolved data.

### Layout shell
- Top nav `56px`, sidebar `232px`, content max `1280px` with `24px` gutter.
- Sidebar nav is **role-scoped**: each role only sees the sections it can actually operate on (see §5). Build one `<Sidebar role="admin|doctor|receptionist|patient" />` component, not four different sidebars.
- Top-nav right cluster: global search (`⌘K`), notifications, avatar menu. Identical across roles.

---

## 5. Role-scoped navigation patterns

| Role | Sidebar sections |
|---|---|
| **Admin** | Users · Assignments · Specialties · Audit log · Settings |
| **Doctor** | Today · Schedule · Availability · Patients · Settings |
| **Receptionist** | Today · Book appointment · My doctors (switcher) · Patients · Settings |
| **Patient** | Find a doctor · My appointments · Records · Settings |

Rules:
- The active route is marked with `primary-700` text + a 2px `primary-500` left rail. No filled background on the nav item itself.
- A collapsed count chip (`neutral-100` bg, `text-xs mono`) sits right-aligned on items with a pending/unread count (e.g. "Today 3").
- Receptionist's "My doctors" is a switcher, not a list page — it opens a popover of assigned doctors and swaps the schedule context.

---

## 6. Writing / copy rules

- **Sentence case everywhere.** "Book appointment", not "Book Appointment". Except proper nouns and Dr. titles.
- Times: `09:30`, not `9:30 AM`. Use 24-hour in data, 12-hour in prose with a space (`9:30 am`). Always consistent per screen.
- Dates: `Apr 22, 2026` in UI; `2026-04-22` only in audit/export contexts.
- Never say "Please". Never say "We're sorry, but…". Clinical tone is direct and calm.
- Empty-state hero copy: 1 sentence, sentence case, serif display. "No appointments today." — not "You have no appointments scheduled at this time."

---

## 7. How to add to the system

1. Open a design review issue referencing MEDI-51.
2. Post a side-by-side of the proposed addition against the closest existing component.
3. If approved, add the token/component to `tokens.css` + Tailwind config + Design System artifact **in the same PR**. All three, or none.
4. Run the acceptance checklist in the PR template: role-scoped nav still works, status badges still map, empty-state copy follows §6, no new colors introduced outside the scale.

**Do not fork tokens.** If you need a value that doesn't exist, propose it. There is no "just this once."

---

*Maintained by the MediSlot frontend squad. Last touched alongside MEDI-51.*
