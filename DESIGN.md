---
name: Kingdom Academy
description: The Kingdom Library's warm dashboard, turned into a members area where course covers and the student's own progress are the only loud things.
colors:
  canvas: "#f5f3f0"
  canvas-2: "#efece8"
  surface: "#ffffff"
  surface-2: "#fbfaf8"
  sunken: "#f1eeea"
  line: "#e8e3dd"
  line-strong: "#d9d3cb"
  ink: "#1c1a17"
  ink-2: "#3b3732"
  muted: "#6f6962"
  faint: "#7d766e"
  orange-300: "#ffb38a"
  orange-400: "#ff8a4c"
  orange-500: "#f4621d"
  orange-600: "#e14e0c"
  orange-soft: "#fff0e7"
  orange-ink: "#b8400a"
  accent: "#f4621d"
  accent-soft: "#fff0e7"
  accent-ink: "#b8400a"
  cta-glow: "#ff7f37"
  cta-deep: "#f2570f"
  green: "#15803d"
  green-soft: "#e3f6ea"
  green-ink: "#0f7a37"
  red: "#d42a39"
  red-soft: "#fde8ea"
  red-ink: "#b4202d"
  amber-soft: "#fff4d9"
  amber-ink: "#8a5b00"
  blue-soft: "#e6f1fb"
  blue-ink: "#1f5f9a"
  violet-1: "#7b72e8"
  violet-2: "#564cc9"
  violet-soft: "#ecebfc"
  violet-ink: "#4a42b8"
  art-ink: "#1d1b18"
  player-ground: "#12110f"
  field-sky: "#d6ebf8"
  field-sand: "#ffe6b3"
  field-meadow: "#d9eed0"
  field-blush: "#f8d5cf"
  field-lagoon: "#cbedee"
  field-lavender: "#e8e2fb"
  field-wheat: "#f3e0c3"
  field-apricot: "#fde0c6"
typography:
  display:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "clamp(26px, 3.2vw, 34px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  display-hero:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "clamp(28px, 3.6vw, 40px)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  numeral:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  cover-initials:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "clamp(34px, 4vw, 46px)"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "Google Sans, Product Sans, Segoe UI, Roboto, system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  pill: "999px"
  panel: "30px"
  xl: "26px"
  lg: "22px"
  md: "16px"
  field: "14px"
  sm: "12px"
spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "18px"
  xl: "22px"
  xxl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.cta-deep}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  button-primary-lg:
    backgroundColor: "{colors.cta-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 26px"
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-text:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  button-text-hover:
    backgroundColor: "{colors.sunken}"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: "42px"
  button-outline-hover:
    backgroundColor: "{colors.accent-soft}"
  button-danger:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "42px"
  button-danger-soft:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.red-ink}"
    rounded: "{rounded.pill}"
    height: "42px"
  button-danger-soft-hover:
    backgroundColor: "{colors.red-soft}"
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    size: "40px"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "38px"
  filter-chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
  pill-neutral:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  pill-active:
    backgroundColor: "{colors.green-soft}"
    textColor: "{colors.green-ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  pill-done:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  pill-risk:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  pill-price:
    backgroundColor: "{colors.orange-soft}"
    textColor: "{colors.orange-ink}"
    rounded: "{rounded.pill}"
    padding: "0 13px"
    height: "30px"
  pill-upcoming:
    backgroundColor: "{colors.violet-soft}"
    textColor: "{colors.violet-ink}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "28px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "22px"
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.numeral}"
    rounded: "{rounded.lg}"
    padding: "18px 20px 20px"
  course-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  course-cover:
    backgroundColor: "{colors.field-apricot}"
    textColor: "{colors.art-ink}"
    typography: "{typography.cover-initials}"
    rounded: "{rounded.md}"
  continue-card:
    backgroundColor: "{colors.surface}"
    typography: "{typography.headline}"
    rounded: "{rounded.lg}"
    padding: "14px 22px 14px 14px"
  event-date-tile:
    backgroundColor: "{colors.violet-2}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    width: "52px"
    height: "56px"
  event-date-tile-past:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-2}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "48px"
  nav-item:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  tabbar-item-active:
    textColor: "{colors.accent-ink}"
  login-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "30px 28px"
    width: "440px"
  certificate:
    backgroundColor: "#ffffff"
    textColor: "#1c1a17"
    rounded: "{rounded.xl}"
    padding: "56px 44px 44px"
    width: "640px"
---

# Design System: Kingdom Academy

## Overview

**Creative North Star: "The Warm Dashboard, Loud Progress"**

Kingdom Academy adopts the Kingdom Library world whole and bends it toward learning. The chrome is a quiet warm-stone canvas with soft white cards on generous 22px corners and one orange gradient that marks the way forward. Two things get to be loud. The first is the course covers: a pastel field with the course image, or large initials when there is no image. The second is the student's own progress: orange-gradient bars, the Continuar card and the KPI numerals.

Density is moderate and dashboard-like. A 264px sidebar sits on a deeper stone. The main column opens with a greeting headline and a muted date lead, then the Continuar card, a KPI row and grids of course cards. Every pressable shape is a full pill, and every container is a large rounded card lifted by warm, diffuse shadows. Type is Google Sans only: weight 500 for everything that names something, 400 for running text, and 700 only in the wordmark.

The Academy is also white-label within the Kingdom family. In Aparência the admin can change the accent colour, the name, the logo, the default theme and the login copy. The system is built so any accent recolours the single orange voice without touching the stone neutrals, the pastel fields or the status colours. The world rejects the dark "creator-course" LMS template: black ground, neon accent and uppercase eyebrows over every heading.

**Key Characteristics:**
- Warm grey-white canvas (`canvas`) with white, barely graded cards (`surface` to `surface-2`).
- One accent voice. The sunrise gradient (`cta-glow` to `cta-deep`) is used for the single primary action per view, progress fills, the play disc and brand panels.
- Full-pill buttons, chips, pills, search, segmented controls and toggles. Containers use 22px corners.
- Soft, negative-spread, warm-tinted shadows. There are no hard edges or offset blocks.
- Course covers on eight pastel fields, with initials in `art-ink` when no image is set. This is the only multi-hue area of a screen.
- Google Sans at weights 400/500. Weight 700 is reserved for the wordmark and the email band.
- Full light and dark themes from the same custom properties. The theme can be auto, light or dark.
- The certificate and the email letter are fixed-light paper objects that ignore the theme.

## Colors

The palette is a warm stone neutral ramp with one admin-configurable accent, semantic soft/ink pairs for status, a single violet reserved for time and people, and eight pastel fields for course art.

### Primary
- **Kingdom Orange** (`accent`, default `orange-500`): the solid accent for the active nav icon, active tab-bar icon, editor-tab underline, focus-ring tint, caret, checkbox accent, star ratings, unread dots, the in-progress lesson ring and the banner-dot indicator.
- **Sunrise CTA Gradient** (`cta-glow` to `cta-deep`, 180deg): the primary button, every progress fill, the play disc on the Continuar thumbnail and video placeholder, the XP badge and onboarding step fills. Its hover lifts to `#ff8b47` → `orange-500`. The report bar charts use a 90deg `orange-400` → `orange-500` gradient instead.
- **Brand Panel** (160deg `#ff8a45` → `#f25a12` → `#d9470a`): the login brand side, the Aparência login preview and the initials avatar.
- **Apricot Wash / Burnt Ink** (`accent-soft` / `accent-ink`, defaulting to `orange-soft` / `orange-ink`): selected lesson and checklist rows, pinned chat messages, liked actions, the streak pill and icon tiles. `orange-ink` is also the link colour ("Ver todos" and the login footer links) and the price-pill text.

### Admin-configurable accent
The accent lives in Aparência. The accent values `#f4621d` (Kingdom orange) and `#ff5a1f` (the Academy's legacy orange) both count as "the house colour". With either of them, no inline override is written and the full Library palette above applies unchanged. Any other colour `c` is written onto the root element and derives the whole voice from it:
- `--accent` = `c`. `--accent-soft` = `color-mix(in srgb, c 14%, var(--surface))`. `--accent-ink` = `color-mix(in srgb, c 72%, var(--ink))`. `--accent-line` = `c` at 35% alpha.
- `--cta` = 180deg from `c` lightened 14% to `c`. `--cta-hover` = `c` lightened 22% to `c` lightened 6%. `--cta-shadow` glows in `c` at 55%.
- `--brand-panel` = 160deg from `c` lightened 16% to `c`. `--ring` = `c` at 28%.
- The crown mark is drawn on a flat `c` square instead of the orange gradient. An uploaded logo replaces the crown entirely.

Because soft and ink are mixed against `surface` and `ink`, a custom accent follows the dark theme automatically.

### Secondary
- **Time Violet** (`violet-1` to `violet-2`, 160deg): only the date tile of an upcoming live session and the "Em breve" pill (`violet-soft` / `violet-ink`). Violet means "a person or a time still to come", never decoration.

### Tertiary (status)
- **Done Green** (`green`): the solid "Concluído" pill, completed-lesson check discs, toggles in the on state and the leading row dot for completed or active rows. `green-soft` / `green-ink` are for active and published pills, correct quiz answers and the "done" button state.
- **Alert Red** (`red`): the solid danger button. `red-soft` / `red-ink` are for errors, wrong answers, the failure bar and soft-danger actions.
- **Amber soft/ink**: at-risk and draft states, highlighted chat messages and embed warnings. The at-risk row dot is `#d99a00` on an `amber-soft` halo.
- **Blue soft/ink**: honest notices, the preview bar and login notes.

### Neutral
- **Stone Canvas** (`canvas`): the page ground. The sidebar sits one step deeper on `canvas-2`.
- **Paper White** (`surface`, `surface-2`): cards, inputs, secondary buttons, the selected nav item and the tab bar. Cards use a 180deg gradient between the two. Table headers and row hover use `surface-2`.
- **Sunken Stone** (`sunken`): hover fills, the segmented-control track, neutral pills, progress tracks, module number discs, past date tiles and read-only fields.
- **Hairlines** (`line`, `line-strong`): 1px card, chip and row borders use `line`. Input strokes, unchecked status rings and dashed placeholders use `line-strong`.
- **Ink ramp** (`ink`, `ink-2`, `muted`): headings and values use `ink`. Labels and nav text use `ink-2`. Leads, metadata and nav group labels use `muted`.
- **Faint** (`faint`): placeholders, input hover borders and the scrollbar hover only. It is below AA as text on canvas.
- **Player Ground** (`player-ground`): the fixed near-black behind embedded video in both themes.

### Course Fields (art only)
There are eight pastel grounds: `field-apricot`, `field-sky`, `field-meadow`, `field-lavender`, `field-sand`, `field-lagoon`, `field-blush`, `field-wheat`. Each course gets one by a stable hash of its id, so the same course always wears the same field on its card, hero, Continuar thumbnail, admin summary and onboarding row. Initials are set in `art-ink`. In dark mode the fields darken (for example sky `#23384a`, apricot `#4a3426`) and `art-ink` flips to `#f4f0ea`.

### Dark theme
Every neutral and every soft/ink pair has a dark counterpart: canvas `#141311`, canvas-2 `#1a1816`, surface `#1e1c19`, sunken `#26231f`, line `#2f2b27`, ink `#f4f0ea`, muted `#aaa298`. Soft fills darken and ink tones lighten. The solid accents (orange gradient, green, red, violet) keep their values. The dark theme applies under `prefers-color-scheme: dark` unless `data-theme="light"` is set, and always under `data-theme="dark"`. The three theme values are `auto` (no attribute, follows the system), `light` and `dark`. The default comes from Aparência, and the topbar toggle stores the person's own choice, which wins.

### Named Rules
**The Loud Covers Rule.** Course covers on their pastel field are the only multi-hue area on a screen. Chrome stays in stone neutrals plus the one accent, and status colour appears only inside pills, dots, date tiles and notices.

**The One Accent Rule.** Every accent use goes through `--accent`, `--accent-soft`, `--accent-ink`, `--cta` or `--brand-panel`, so an Aparência colour recolours it. The certificate and email are the only places with literal orange.

**The Violet Means Time Rule.** Violet is spent only on upcoming live sessions. A session that has passed loses its violet and goes to `sunken`.

## Typography

**Display Font:** Google Sans (with Product Sans, Segoe UI, Roboto, system-ui)
**Body Font:** Google Sans (same stack)
**Label/Mono Font:** Google Sans for all labels. A system monospace (`ui-monospace`, SF Mono, Menlo, Consolas) is used only in code blocks, embed status and integration keys.

**Character:** One geometric-humanist sans at two weights. Headings get their authority from size and tight negative tracking, never from bold.

### Hierarchy
- **Display** (500, `clamp(26px, 3.2vw, 34px)`, 1.2, -0.025em): page greetings ("Olá, Aluno."), page titles and admin form titles.
- **Display Hero** (500, `clamp(28px, 3.6vw, 40px)`, 1.1, -0.03em): the course hero title and the login brand headline.
- **Numeral** (500, 38px, line-height 1, tabular): KPI values, with a 15px `muted` unit or denominator ("/ 42", "%"). It drops to 30px under 640px.
- **Cover Initials** (500, `clamp(34px, 4vw, 46px)`, -0.03em, `art-ink` at 88%): course initials on a card cover. They grow to `clamp(56px, 6vw, 84px)` in the course hero and shrink to 30px on mobile.
- **Headline** (500, 21-22px): the Continuar card title, dialog and drawer titles, and the XP card.
- **Section** (500, 20px, -0.02em): section titles such as "Os teus cursos" with a right-aligned `orange-ink` "Ver todos".
- **Title** (500, 16.5-17px, 1.3): card titles, course names, module names and widget labels.
- **Body** (400, 15px, 1.5; 14.5px under 640px): running text. Leads are `muted` and capped at 56-64ch. Lesson content runs at 15.5px/1.75 in `ink-2`, capped at 68ch.
- **Label** (500, 13.5px): field labels, segmented controls and small buttons. Buttons run 14.5px (16px large) at 500.
- **Caption** (400, 12.5px): hints, timestamps, table sub-lines and table headers (500).

Tabular numerals are used on every percentage, count, duration, date tile, price and KPI.

### Named Rules
**The Medium Weight Rule.** Headings, labels, buttons and numerals are 500. Weight 700 appears only in the wordmark (17px, -0.02em) and the email band title.

**The No Eyebrow Rule.** Page, card, hero and dialog headings stand alone, with no small label line above them. The greeting's context goes into the lead underneath ("Quinta-feira, 24 de setembro." in `ink-2` 500, then `muted`). Sidebar group labels ("Geral", "Progresso", "Conta"), KPI labels and table headers are navigation and data labels, not kickers.

## Layout

The app shell has two columns. A fixed 264px sidebar sits on `canvas-2` with a right hairline. The main column holds a top bar (pill search up to 420px, theme and notification icon buttons, initials avatar) and content with padding `26px clamp(16px, 3vw, 40px) 64px`, capped at 1260px. The page head aligns title and lead left and any action right, with 24px below.

- **Student Início:** greeting, Continuar card, a horizontal row of 250px mini continue cards, the KPI row (four columns, 16px gap), the banner carousel (4:1, 22px corners), a two-up widget row (next live session, featured achievement), then the course grid.
- **Course grid:** auto-fill `minmax(250px, 1fr)`, 18px gaps. It becomes two columns with 12px gaps under 640px.
- **Course page:** a hero card with text left and a 380px field art panel right, then accordion module cards.
- **Lesson:** a 16:9 player plus a sticky 320px lesson list. It stacks under 1180px.
- **Admin forms:** a 300px description column beside a form card. It stacks under 1000px.
- **Rhythm:** 4/8/12/16/18/22/26px. 16px is the stat and widget gap, 18px the grid gap, 22px the card padding and 26px the section gap.

Breakpoints:
- 1180px: the lesson layout and settings stack, and the course hero art narrows to 300px.
- 1000px: admin form sections stack.
- 980px: the sidebar becomes a drawer (max 300px, 26px right corners, pop shadow). A sticky blurred top bar holds the brand (canvas at 88%, 12px blur, hairline below). A fixed white bottom tab bar with safe-area insets appears. KPIs go two-up, the widgets stack, the login split stacks and the course hero art moves on top.
- 640px: tighter cards and a two-up course grid with descriptions hidden. Filter chips scroll horizontally. The Continuar card compresses to a 72px square thumbnail and drops its button (the whole card is the tap target).

## Elevation & Depth

Depth is lifted, not flat. Cards rest on a soft, warm-tinted shadow and interactive cards rise on hover. Every light-theme shadow uses a warm near-black (`rgba(28,22,16,…)`), a large blur and negative spread, so it reads as ambient glow rather than a drawn edge. The dark theme swaps to pure black at higher opacity.

### Shadow Vocabulary
- **Rest** (`--shadow-1`: `0 1px 2px rgba(28,22,16,.05), 0 6px 18px -8px rgba(28,22,16,.10)`): cards, the login card, the active nav item and the banner track.
- **Lift** (`--shadow-2`: `0 2px 6px rgba(28,22,16,.06), 0 18px 40px -16px rgba(28,22,16,.22)`): hover on course, continue and certificate cards, and the video player.
- **Pop** (`--shadow-pop`: `0 12px 32px -8px rgba(28,22,16,.28), 0 2px 8px rgba(28,22,16,.08)`): dialogs, drawers, toasts, the notification panel, floating menus and the open mobile sidebar.
- **CTA glow** (`--cta-shadow`: inset 1px white highlight plus `0 6px 16px -4px rgba(226,78,12,.55)`): primary buttons, the play disc and the XP badge. It follows a custom accent.
- **Violet glow** (`0 10px 20px -12px rgba(86,76,201,.8)` plus inset highlight): the upcoming event date tile only.
- **Tab bar lift** (`0 -8px 24px -18px rgba(28,22,16,.35)`): the mobile bottom bar.
- **Focus ring** (`--ring`: `0 0 0 3px rgba(244,98,29,.28)`): every `:focus-visible` and focused input. It follows a custom accent.

### Named Rules
**The Soft Lift Rule.** Shadows are diffuse and warm with negative spread. A hover lift is `translateY(-3px)` plus Rest → Lift over 0.25s. Locked cards do not lift. There are no zero-blur offset shadows.

## Shapes

- **Pills:** every pressable or filterable control is a full pill (999px): buttons, icon buttons, chips, status pills, the price pill, search, selects in the toolbar, segmented controls, toggles, progress bars and the preview notice.
- **Cards:** containers use 22px (`lg`). Dialogs, the certificate and drawers step up to 26px (`xl`). The login brand panel uses 30px.
- **Nested shapes:** inner shapes step down. A course cover (16px, `md`) is inset 10px inside its 22px card, and the hero art is inset 14px. Date tiles and thumbnails are 16px, fields and nav items 14px, small thumbnails 10-12px and checkboxes 6px.
- **Circles:** avatars, the play disc, module and step numbers, lesson status rings and the padlock disc.
- **Dashed borders:** a 1.5px dashed `line-strong` border marks only empty or drop targets (upload boxes, image previews, "Nova aula", the login demo note).

## Components

### Buttons
Buttons are tactile, rounded and confident. There is one hot button per view, and the rest stay quiet.
- **Shape:** full pill. Heights are 42px (default), 52px (large, for login and hero actions) and 34px (small).
- **Primary:** the Sunrise gradient with a white 500 label, CTA glow and 0 18px padding. Hover brightens the gradient and `:active` nudges down 1px. Trailing arrows are a small circled-arrow stroke icon. Disabled drops to 55% opacity.
- **Secondary:** Paper White with a `line` border and a hairline shadow. Hover goes to `surface-2` and `line-strong`.
- **Text:** transparent `ink-2`, with a Sunken fill on hover.
- **Outline:** white with an `accent-line` border and `accent-ink` text. Hover fills `accent-soft`.
- **Danger:** solid `red` with a red glow, used for confirmed destructive actions in dialogs. **Soft danger:** white with `red-ink` text, filling `red-soft` on hover.
- **Done state:** a button marked done turns `green-soft` / `green-ink` with no shadow ("Aula concluída").
- **Icon button:** a 40px white circle with a `line` border (36px under 420px). In rows it is a 34px transparent circle that fills Sunken on hover and `red-soft` for danger.

### Chips
- **Filter chips:** 38px white pills with an optional colour dot and a count bubble. Selected inverts to `ink` fill with `canvas` text.
- **Status pills:** 28px with a 7px leading dot in `currentColor`. Soft pairs cover lifecycle states: active or published (green), at risk or draft (amber), inactive (sunken). Solid green means concluded. "Em breve" is violet-soft and "Realizado" is sunken.
- **Access tags:** 24px pills. Gratuito is green-soft, Exclusivo is orange-soft and Pago is sunken.
- **Price pill:** 30px `orange-soft` / `orange-ink` pill with tabular numerals, never wrapping (`MZ 1 500,00`).
- **Category tag:** an 8px dot in the category colour beside a 13px `ink-2` label.
- **Segmented control:** a Sunken pill track with 4px padding. The pressed option becomes a white pill with a small shadow.

### Cards / Containers
- **Corner Style:** 22px.
- **Background:** a 180deg gradient from `surface` to `surface-2` (dark: `#211f1c` to `#1c1a17`).
- **Shadow Strategy:** Rest, plus Lift on hover for interactive cards (see Elevation).
- **Border:** 1px `line`.
- **Internal Padding:** 22px. Table and widget heads use `18px 22px` with a 17px title.

### Inputs / Fields
- **Style:** 48px tall, 14px radius, 1px `line-strong` stroke, white fill and 16px side padding. Labels are 13.5px/500 `ink-2` with a 7px gap, and hints are 12.5px `muted`.
- **Focus:** the border turns `accent` and the focus ring appears. Hover darkens the border to `faint`.
- **Error / Read-only:** errors are a `red-soft` / `red-ink` notice block. Read-only fields sit on Sunken with `ink-2` text.
- **Search:** a 46px pill in the top bar and a 40px pill in admin filter bars, with a leading 18px icon.
- **Chat composer:** a 24px-radius auto-growing textarea beside the send button.

### Navigation
- **Sidebar:** 15px/500 `ink-2` items with 18px 1.8-stroke icons, `8px 12px` padding and a 14px radius. Hover fills Sunken. The active item is a white raised tile (Rest shadow) with an accent icon. New-activity dots are 8px accent circles with an `accent-soft` halo. Group labels are 12px/500 `muted`. The student sidebar foot shows overall progress with a gradient bar.
- **Mobile (below 980px):** a sticky blurred top bar with the crown and wordmark, and a fixed white bottom tab bar. Tabs have 22px icons and 11.5px/500 labels. The active tab has `accent-ink` text and an accent icon. The "Mais" tab opens the sidebar as a drawer.
- **Editor tabs (admin):** 14.5px/500 `muted` labels with a 2px accent underline and accent icon when selected.

### Course Card (signature)
A card with a 16:10 cover inset 10px (16px radius). The cover is either the course image (cover-fit) or the course's pastel field with its initials in Cover Initials type. A white 92% category badge with a colour dot sits top-left. The body has a 16.5px title, a two-line `muted` description and a foot row with "2 de 12 aulas" and a tabular percentage over a gradient progress bar.
- **Concluded:** a solid green badge top-right.
- **Locked:** the cover is at 50% saturation with a 38px dark translucent padlock disc top-right, and there is no hover lift.
- **Vitrine:** a hairline-separated offer row with the price pill and a full-width primary button that goes to Payflow.
- **Admin:** hover reveals white icon-button actions bottom-right. They are always visible on touch.

### Continuar Card (signature)
The first thing on Início. A 168px 16:10 thumbnail on the course field (or the lesson image) carries a 52px gradient play disc. Beside it are the 21px lesson title, a `muted` "Módulo · Curso" line, a gradient progress bar (max 260px) with "17% do curso", and the view's single primary button "Continuar". The whole card lifts on hover. Under 640px the thumbnail becomes a 72px square and the button hides.

### KPI Stat Card
A 14px `ink-2` label above a 38px tabular numeral with a 15px `muted` unit. An optional 36px round icon tile top-right is hidden under 640px. The cards come in rows of four (or three), and two-up under 980px. There is no chart inside the card.

### Event Date Tile
A 52×56px tile with 16px corners: a 19px tabular day over an 11px month abbreviation ("SET"). An upcoming session gets the violet gradient with violet glow. A past session drops to `sunken` with `ink-2` text and no glow. In the calendar a row expands in place into a `surface-2` detail block with session facts and actions. Admin tables use a 42px version.

### Admin Tables
These are table cards with no padding and a hairline-separated head (17px title, tabular count, action right). Headers are 12.5px/500 `muted` on `surface-2`. Cells are 14px with `13px 18px` padding, `line` row dividers and `surface-2` on hover. The first cell is usually a user cell (34px initials avatar, 500 name, 12.5px sub-line). Numbers are right-aligned and tabular. Row state is a **7px leading dot** in the first cell with a 3px soft halo: green for completed or active, amber (`#d99a00`) for at-risk or blocked. Rows are never tinted. Secondary columns collapse into sub-lines below 1560px and 1240px.

### Login Split
Two columns (1.05fr / 1fr) on canvas. On the left is a brand panel inset 14px with 30px corners, filled with `--brand-panel`, soft radial highlights and concentric white rings bottom-right. It carries the crown and wordmark top-left, the admin-editable headline (Display Hero, white, max 18ch) and text, and a footer line. On the right is a **white form card** (max 440px, 22px corners, Rest shadow, `30px 28px` padding) with a 30px title, a `muted` sub, 48px fields and a 52px full-width gradient pill. Below 980px the panel stacks on top and its footer hides. Aparência shows a live miniature of the same split.

### Certificate (fixed light paper)
The certificate is paper, so it is white with `#1c1a17` text in any theme. It is a 640px max card with 26px corners and two inset frames: a 1px `#eee8e1` hairline at 12px and a 35% orange line at 18px. From top to bottom it holds the crown (accent-coloured), a sentence-case title line in `#6f6962`, the student's name at 32px/500, the phrase, the course name in `#b8400a` 21px/500, a signature line and a tabular issue date. The certificate grid previews use the same white paper with a double inset border on a 1.6:1 tile. A locked preview goes grayscale at 60%.

### Email Letter (fixed light)
Emails ignore the app theme (`color-scheme: light only`) and use literal values in inline table layout. The layout is a 560px white card (18px radius, `#ebe6e0` border) on `#f3f1ee`. It opens with one orange band (160deg `#ff8a45` → `#ee5410`, `#f25a12` fallback) holding a 40px logo and the 18px/700 white wordmark. The 30px body has a 25px/500 headline and 15.5px/1.6 text in `#3b3732`. The one CTA is the Sunrise gradient pill (14px 26px padding) with the CTA glow. A 13.5px `muted` note sits above a `#efe9e2` rule, and the footer is 12px on `#faf8f5` with an `#b8400a` link.

### Motion
One easing, `cubic-bezier(.22,1,.36,1)`, is used everywhere. Controls transition in 0.15-0.2s, card lifts in 0.25s and module accordions in 0.3s. Dialogs, menus and toasts rise 14px with scale .98 in 0.2-0.3s. Drawers slide 40px in 0.3s. View changes fade up 6px in 0.35s, and the loading crown breathes at 1.8s. `prefers-reduced-motion` collapses all of these to near zero.

## Do's and Don'ts

### Do:
- **Do** keep one primary gradient CTA per view. On Início it is "Continuar".
- **Do** route every accent use through `--accent`, `--accent-soft`, `--accent-ink`, `--cta`, `--brand-panel` or `--ring` so the Aparência colour carries through. Only `#f4621d` and `#ff5a1f` keep the full Library palette.
- **Do** give every course cover its hashed pastel field, and fall back to initials in `art-ink` when there is no image.
- **Do** show locked content as locked (desaturated cover, padlock disc, price pill or path to it), never hidden and never painted as open.
- **Do** make every pressable control a full pill and every container a 22px card with the Rest shadow.
- **Do** mark admin row state with a leading 7px dot in the first cell.
- **Do** set headings at 500 with negative tracking (-0.015em to -0.03em) and use tabular numerals for money, counts, percentages, durations and dates.
- **Do** keep the certificate and emails fixed light with literal values. Everything else follows the auto/light/dark theme through the root custom properties.

### Don't:
- **Don't** put an eyebrow or kicker line above page, card, hero or dialog headings. Context goes in the lead below.
- **Don't** tint whole table rows for state.
- **Don't** use violet for anything but upcoming live sessions, and don't leave a past session violet.
- **Don't** use weight 700 outside the wordmark and email band, and don't introduce a second typeface.
- **Don't** use zero-blur offset shadows or cool grey shadows.
- **Don't** use `faint` for readable text. Use `muted`.
- **Don't** drift toward the dark creator-course template (black ground, neon accent, uppercase labels).
