# COACH_DESIGN_SPEC.md
# Training Planner — Coach Module

> This document describes the UX/UI of the coach module for handoff to Claude Code.
> The athlete module is a separate spec (ATHLETE_DESIGN_SPEC.md).
> Version: v1.0 · May 2025

---

## 1. Project context

### 1.1 What already exists

The project has an existing design token file with CSS custom properties (`colors.css` or equivalent).
**All colors must come exclusively from that file** — no new hex values are introduced.
All new UI components must use the same tokens and visual language.

```css
/* Existing tokens — use only these */
--color-bg-page-start, --color-bg-page-end      /* page background gradient */
--color-surface, --color-surface-raised          /* surfaces */
--color-surface-table-header, --color-surface-highlight
--color-text-heading, --color-text-body          /* text */
--color-text-label, --color-text-muted, --color-text-placeholder
--color-border, --color-border-input, --color-border-row
--color-focus                                    /* :focus ring */
--color-primary, --color-primary-text            /* CTA buttons */
--color-danger-bg, --color-danger-text           /* destructive actions */
--color-ghost-bg                                 /* secondary buttons */
--color-shadow-card, --color-shadow-btn          /* shadows */
--color-overlay                                  /* modal backdrop */
```

### 1.2 New tokens to add to colors.css

Append to the same file at the bottom, under the comment `/* --- Status --- */`:

```css
/* --- Status --- */
--color-status-done-bg:     #dcfce7;   /* completed slot — background */
--color-status-done-text:   #14532d;   /* completed slot — text */
--color-status-done-border: #86efac;   /* completed slot — border */

--color-status-planned-bg:     #dbeafe;  /* planned slot — background */
--color-status-planned-text:   #1e40af;  /* planned slot — text */
--color-status-planned-border: #93c5fd;  /* planned slot — border */

--color-status-skipped-bg:     #fee2e2;  /* skipped slot — background */
--color-status-skipped-text:   #991b1b;  /* skipped slot — text */
--color-status-skipped-border: #fca5a5;  /* skipped slot — border */

--color-status-warn-bg:     #fef3c7;   /* warning (no plan) — background */
--color-status-warn-text:   #92400e;   /* warning — text */
--color-status-warn-border: #fde68a;   /* warning — border */

/* --- RPE (workout difficulty) --- */
--color-rpe-easy-bg:   #dcfce7;  /* RPE 1–3 */
--color-rpe-easy-text: #14532d;
--color-rpe-mid-bg:    #fef3c7;  /* RPE 4–6 */
--color-rpe-mid-text:  #92400e;
--color-rpe-hard-bg:   #fee2e2;  /* RPE 7–10 */
--color-rpe-hard-text: #991b1b;

/* --- Slot bar (progress strips on athlete card) --- */
--color-slot-done:    #16a34a;
--color-slot-planned: #93c5fd;
--color-slot-skipped: #fca5a5;
--color-slot-empty:   var(--color-border);
```

### 1.3 New UI components to add to the ui-kit

Add the following reusable components to the existing ui-kit:

| Component | Description |
|---|---|
| `<SlotBar>` | A row of colored progress strips representing workout slots |
| `<StatusBadge>` | Status badge (done / pending / skipped / no plan) |
| `<WorkoutSlotCard>` | Card for a single workout slot with its exercises |
| `<WeekNav>` | Previous/next week navigation with a label |
| `<AthleteCard>` | Athlete card in the coach's grid view |
| `<RpeChip>` | Compact chip displaying an RPE difficulty score |

---

## 2. Information architecture — coach module

```
/coach
├── /athletes                          ← list of all athletes
│   └── /:athleteId
│       └── /week/:weekId              ← weekly plan for a specific athlete
│           └── /copy                  ← select a week to copy from
```

### Role model

- A user authenticated with the `coach` role sees only these routes.
- A user with the `athlete` role has no access to the coach module.
- Role switching is not available in the UI — role is set at authentication time.

---

## 3. Screen 1 — Athletes list (`/coach/athletes`)

### 3.1 Layout

```
┌─────────────────────────────────────────────────────┐
│ TOPBAR: logo · spacer · role label · coach avatar   │
├─────────────────────────────────────────────────────┤
│ PAGE HEADER                                         │
│   h1: "My athletes"                                 │
│   sub: "N athletes · week NN, dd–dd Mon YYYY"       │
│   right: [+ Add athlete] button                     │
├─────────────────────────────────────────────────────┤
│ LEGEND ROW (small badge legend for SlotBar)         │
├─────────────────────────────────────────────────────┤
│ GRID 3 columns (auto-fit, minmax 220px)             │
│   AthleteCard × N                                   │
└─────────────────────────────────────────────────────┘
```

**Page background:** `linear-gradient(135deg, var(--color-bg-page-start), var(--color-bg-page-end))`

### 3.2 AthleteCard component

**Card anatomy, top to bottom:**

```
┌──────────────────────────────────────┐
│ [Avatar] First Last         [Badge]  │  ← ath-top
│          Sport                       │
├──────────────────────────────────────┤
│ ▬▬▬  ▬▬▬  ▬▬▬  (SlotBar)            │  ← slot-strip
├──────────────────────────────────────┤
│ 🕐 Yesterday at 18:30  ·  status    │  ← ath-meta
└──────────────────────────────────────┘
```

**Card styles:**
- `background: var(--color-surface)`
- `border: 0.5px solid var(--color-border)`
- `border-radius: 14px`
- `padding: 12px`
- `cursor: pointer`
- `hover`: border transitions to `var(--color-status-planned-border)` + subtle `transform: translateY(-1px)`

**Avatar:**
- Circle 34×34px, 2-letter initials
- Background/text color is set server-side (per-athlete, from the set: blue, green, amber, pink, purple)
- Do not generate randomly on the frontend — store in the athlete model

**SlotBar component:**
- Flex row, `gap: 5px`
- Each strip: `flex: 1`, height 6px, `border-radius: 3px`
- Strip color by slot status:
  - `done` → `var(--color-slot-done)` (#16a34a)
  - `planned` → `var(--color-slot-planned)` (#93c5fd)
  - `skipped` → `var(--color-slot-skipped)` (#fca5a5)
  - `empty` (no plan) → `var(--color-slot-empty)` (gray)
- Number of strips = number of slots in the current week's plan (typically 3)
- If no plan exists — show 3 gray strips

**StatusBadge (top-right corner of the card):**

| State | Text | Colors |
|---|---|---|
| No plan | `no plan` | `--color-status-warn-bg` / `--color-status-warn-text` |
| Plan exists, not started | `0 / N` | `--color-status-planned-bg` / `--color-status-planned-text` |
| In progress | `K / N` | `--color-status-planned-bg` / `--color-status-planned-text` |
| Has skipped sessions | `M skipped` | `--color-status-skipped-bg` / `--color-status-skipped-text` |
| Week complete | `N / N` | `--color-status-done-bg` / `--color-status-done-text` |

**Metadata row (ath-meta):**
- `ti-clock` icon + relative last-activity time ("Yesterday at 18:30", "3 days ago")
- Separator `·`
- Status icon + text:
  - No plan → `ti-alert-triangle` (amber) + "plan not created"
  - Has skips → `ti-alert-triangle` (amber) + "missed session N"
  - All good → `ti-calendar-week` + "week NN"
  - Closed → `ti-circle-check` (green) + "week complete"

### 3.3 Legend row

Small ghost badges before the grid, explaining SlotBar colors:
- `● planned` (blue dot)
- `● done` (green dot)
- `● skipped` (red dot)
- `● no plan` (gray dot)

Dot: `font-size: 7px`, icon `ti-circle-filled`.

---

## 4. Screen 2 — Athlete's weekly plan (`/coach/athletes/:id/week/:weekId`)

### 4.1 Layout

```
┌───────────────────────────────────────────────────────┐
│ Breadcrumb: Athletes > First Last                     │
├───────────────────────────────────────────────────────┤
│ ATHLETE HEADER                                        │
│   [Avatar 36px] Name · Sport · experience             │
│   right: [Copy from...] [+ Add workout]              │
├───────────────────────────────────────────────────────┤
│ WEEK NAV: [<] Week NN · dd–dd Mon YYYY [>] [badge]   │
├───────────────────────────────────────────────────────┤
│ WORKOUT SLOTS (vertical list)                         │
│   WorkoutSlotCard × N                                 │
│   [+ Add workout] (dashed button)                     │
├───────────────────────────────────────────────────────┤
│ WEEK SUMMARY BAR                                      │
└───────────────────────────────────────────────────────┘
```

### 4.2 Slot concept (IMPORTANT for implementation)

The coach creates **slots** — "Session 1", "Session 2", "Session 3".
**A slot is not tied to a specific day of the week.**
The athlete chooses when to complete each slot.
Upon completion, the system records the actual date and stores it on the slot.

```typescript
WorkoutSlot {
  id: uuid
  weekId: string          // "2025-W21"
  athleteId: uuid
  order: number           // 1, 2, 3...
  title: string           // "Session 1 — Squat / Bench"
  exercises: Exercise[]
  status: 'planned' | 'done' | 'skipped'
  completedAt?: Date      // actual completion date, set by athlete
  rpe?: number            // 1–10, set by athlete
  athleteNote?: string    // athlete's note
}

Exercise {
  id: uuid
  name: string
  sets: number
  reps: number
  weight?: number         // kg, optional
  weightUnit?: 'kg' | 'bw' | 'bw+kg'  // bodyweight variants
}
```

### 4.3 WeekNav component

```
[<btn]  Week 21 · 19–25 May 2025  [>btn]  [StatusBadge "2 / 3 done"]
```

- `<` `>` buttons use icons `ti-chevron-left` / `ti-chevron-right`
- Buttons: `background: var(--color-surface-raised)`, `border: 0.5px solid var(--color-border)`, `border-radius: 6px`, `28×28px`
- Label: `font-size: 13px`, `font-weight: 500`, `color: var(--color-text-heading)`, `text-align: center`, `flex: 1`
- Badge on the right shows the aggregated week status

### 4.4 WorkoutSlotCard component

**Card states:**

| Status | border-color | slot-num icon |
|---|---|---|
| `planned` | `var(--color-border)` | blue circle with number |
| `done` | `var(--color-status-done-border)` | green circle with number |
| `skipped` | `var(--color-status-skipped-border)` | red circle with number |

**Anatomy (top to bottom):**

```
┌ slot-head ──────────────────────────────────────────────────┐
│ [Num] Workout title      [Completion status]     [Badge]   │
│                           (actual date + RPE)               │
└─────────────────────────────────────────────────────────────┘
┌ slot-body ──────────────────────────────────────────────────┐
│ Exercise 1    5×5 · 120 kg                                 │
│ Exercise 2    4×6 · 90 kg                                  │
│ ...                                                          │
└─────────────────────────────────────────────────────────────┘
┌ slot-footer ────────────────────────────────────────────────┐
│ [RpeChip]  "Athlete note..."         [edit] [delete]       │
│  (if done)   (if done + note exists)                        │
└─────────────────────────────────────────────────────────────┘
```

**slot-head:**
- `padding: 10px 14px`
- `border-bottom: 0.5px solid var(--color-border)`
- `display: flex; align-items: center; gap: 10px`

**Num-circle:**
- 22×22px, `border-radius: 50%`
- `planned` → `background: var(--color-status-planned-bg); color: var(--color-status-planned-text)`
- `done` → `background: var(--color-status-done-bg); color: var(--color-status-done-text)`
- `font-size: 11px; font-weight: 700`

**Completion status (slot-athlete-day):**
- If `done`: `ti-circle-check` (green) + "Done dd Mon · RPE N"
- If `planned`: `ti-clock` (muted) + "Not completed yet"
- If `skipped`: `ti-x` (red) + "Skipped"
- `font-size: 11px`

**slot-body:**
- `padding: 10px 14px`
- Each exercise row:
  - `display: flex; align-items: center; gap: 8px`
  - `padding: 5px 0`
  - `border-bottom: 0.5px solid var(--color-border-row)`
  - last row — no border
  - Name: `font-size: 12px; font-weight: 500; flex: 1`
  - Params: `font-size: 11px; color: var(--color-text-muted)`, weight bold: `font-weight: 600; color: var(--color-text-body)`

**slot-footer (visible when status is `done` OR coach is in edit mode):**
- `padding: 8px 14px`
- `border-top: 0.5px solid var(--color-border)`
- `display: flex; align-items: center; gap: 8px`
- Left block: `<RpeChip>` (only if RPE is set)
- Center block: athlete's note in italics, `color: var(--color-text-muted)`, truncated to 60 chars with "…"
- Right block (`margin-left: auto`): edit + delete buttons

**Action buttons in footer:**
- Edit: `btn-ghost btn-sm` with `ti-edit` icon
- Delete: `background: var(--color-danger-bg); color: var(--color-danger-text); btn-sm` with `ti-trash` icon
- Always visible (for both `done` and `planned` slots)

**"+ Add workout" dashed button:**
- `width: 100%`
- `padding: 10px`
- `border: 1.5px dashed var(--color-border-input)`
- `border-radius: 14px`
- `background: transparent`
- `color: var(--color-primary)`
- `font-size: 12px; font-weight: 500`
- `hover: background: var(--color-surface-raised); border-color: var(--color-status-planned-border)`

### 4.5 RpeChip component

```
[icon] RPE N — label
```

| RPE | Icon | Background | Text |
|---|---|---|---|
| 1–3 | `ti-leaf` | `var(--color-rpe-easy-bg)` | `var(--color-rpe-easy-text)` |
| 4–6 | `ti-activity` | `var(--color-rpe-mid-bg)` | `var(--color-rpe-mid-text)` |
| 7–10 | `ti-flame` | `var(--color-rpe-hard-bg)` | `var(--color-rpe-hard-text)` |

Labels: 1–3 "easy", 4–6 "moderate", 7–8 "hard", 9–10 "max effort".
Styles: `display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font-size: 11px`.

### 4.6 Week Summary Bar

Bottom summary row for the week:
- `background: var(--color-surface-raised)`
- `border-radius: 10px`
- `padding: 10px 14px`
- `display: flex; gap: 20px; font-size: 12px`
- Items: icon + text
  - `ti-calendar-event` + "N workouts"
  - `ti-barbell` + "N exercises"
  - `ti-check` (green) + "N done"
  - `ti-clock` (muted) + "N pending"
- Far right: link button "Week history" (`ti-history`) — `btn-ghost btn-sm`

---

## 5. Screen 3 — Copy week (`/coach/athletes/:id/week/:weekId/copy`)

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────┐
│ Breadcrumb: Athletes > Name > Week NN > Copy             │
├──────────────────────────────────────────────────────────┤
│ PAGE HEADER                                              │
│   h1: "Copy weekly plan"                                 │
│   sub: "Pick a source week → copies into week NN →       │
│         then edit each workout individually"             │
│   right: [× Cancel] (btn-ghost → go back)               │
├──────────────────────────────────────────────────────────┤
│ INFO BANNER                                              │
├──────────────────────────────────────────────────────────┤
│ SECTION LABEL: "Select a source week"                    │
├──────────────────────────────────────────────────────────┤
│ WEEK LIST (vertical card list)                           │
│   WeekHistoryCard × N (last 8 weeks)                     │
├──────────────────────────────────────────────────────────┤
│ FOOTER: [Cancel] [Copy week XX → week NN] (CTA)         │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Info Banner

```
┌────────────────────────────────────────────────────────┐
│ [i]  How this works                                    │
│      Workouts are copied as slots with no day binding.  │
│      The athlete will choose when to complete each one. │
└────────────────────────────────────────────────────────┘
```

- `background: var(--color-surface-raised)`
- `border: 1.5px solid var(--color-status-planned-border)`
- `border-radius: 14px`
- `padding: 12px 16px`
- `ti-info-circle` icon 20px, `color: var(--color-primary)`, `flex-shrink: 0`
- Title: `font-size: 13px; font-weight: 600; color: var(--color-status-planned-text)`
- Body text: `font-size: 11px; color: var(--color-primary)` (slightly muted)

### 5.3 WeekHistoryCard component

**States:** default, hover, selected.

```
┌ selected ──────────────────────────────────────────────┐
│  Week 20 · 12–18 May          [3 workouts]  [done]     │
├────────────────────────────────────────────────────────┤
│  S1: Squat / Bench · 5×5 · 115 kg  ·  S2: ...         │
└────────────────────────────────────────────────────────┘
```

Styles:
- Default: `border: 0.5px solid var(--color-border)`, `background: var(--color-surface)`
- Hover: `border-color: var(--color-status-planned-border)`, cursor pointer
- Selected: `border: 1.5px solid var(--color-primary)`, `background: var(--color-surface-raised)`
- `border-radius: 14px; overflow: hidden; cursor: pointer; transition: all 0.15s`

Top row (slot-head):
- `padding: 10px 14px; display: flex; align-items: center; gap: 8px`
- Title: `font-size: 13px; font-weight: 600; flex: 1`
- Badges: workout count (planned), completion status
- `ti-chevron-right` icon on the right

Bottom row (exercise preview):
- `padding: 8px 14px`
- `border-top: 0.5px solid var(--color-border-row)`
- `font-size: 11px; color: var(--color-text-muted)`
- Text: "S1: name · NxN · N kg · S2: ..." — single line, `overflow: hidden; white-space: nowrap; text-overflow: ellipsis`

### 5.4 CTA button

- Disabled until a week is selected: `disabled`, `opacity: 0.4`, `cursor: default`
- After selection: activates, label reads "Copy week XX → week NN"
- On click: performs copy (API call), redirects to `/coach/athletes/:id/week/:weekId`
- Button: `btn-primary` with `ti-copy` icon

---

## 6. Side panel — Add / Edit workout

Opens when clicking "+ Add workout" or the `ti-edit` icon on a slot.
Implemented as a **right-side drawer**, not a centered modal.
Width: 420px. Backdrop: `var(--color-overlay)`.

> Alternative: if the project already has an established modal pattern, use it instead.

### 6.1 Panel structure

```
┌────────────────────────────────────────┐
│ HEADER                                 │
│  Add workout / Edit workout            │
│  [× close]                             │
├────────────────────────────────────────┤
│ BODY (scrollable)                      │
│                                        │
│  Workout title [input]                 │
│                                        │
│  EXERCISES                             │
│  ┌──────────────────────────────────┐  │
│  │ Exercise name [input]            │  │
│  │ Sets [num] × Reps [num]          │  │
│  │ Weight [num] kg / bodyweight[chk]│  │
│  │                     [× remove]  │  │
│  └──────────────────────────────────┘  │
│  [+ Add exercise]                      │
│                                        │
├────────────────────────────────────────┤
│ FOOTER                                 │
│  [Cancel]  [Save workout]              │
└────────────────────────────────────────┘
```

### 6.2 Form fields

**Workout title:**
- `type="text"`, `placeholder="e.g. Session 1 — Squat / Bench"`
- Input styles from existing ui-kit: `border: 1px solid var(--color-border-input)`, focus → `border-color: var(--color-focus)`

**Exercise row:**
- `background: var(--color-surface-raised)`
- `border-radius: 10px`
- `padding: 10px 12px`
- `margin-bottom: 6px`
- Fields: name (`flex: 1`), sets (`width: 52px`), reps (`width: 52px`), weight (`width: 64px`)
- "Bodyweight" checkbox — when checked, the weight field hides and is replaced by "bw" text
- Remove row button: `ti-x` icon, `color: var(--color-text-muted)`, hover → `color: var(--color-danger-text)`

**"+ Add exercise" button:**
- Same dashed style as "+ Add workout" (see 4.4), but smaller: `padding: 7px`

### 6.3 Behaviour

- Client-side validation: workout title is required; at least 1 exercise with a name and sets/reps.
- On save: `POST /api/workout-slots` (new) or `PATCH /api/workout-slots/:id` (edit).
- After save: panel closes, slot list updates (optimistic update).
- Exercises can be reordered via drag-and-drop (optional in v1 — up/down arrow buttons are an acceptable fallback).

---

## 7. Topbar (shared across all coach screens)

```
┌────────────────────────────────────────────────────────┐
│  🏋 TrainWeek  [spacer]  [Coach label]  [Avatar]       │
└────────────────────────────────────────────────────────┘
```

- `height: 54px`
- `background: var(--color-surface)`
- `border-bottom: 1px solid var(--color-border)`
- `position: sticky; top: 0; z-index: 200`
- `padding: 0 20px`
- Logo: `ti-barbell` icon + "TrainWeek" text, `font-weight: 700`, `color: var(--color-primary)`
- Role label: `font-size: 11px`, `background: var(--color-surface-raised)`, `border: 0.5px solid var(--color-border)`, `border-radius: 6px`, `padding: 3px 10px`, `ti-user` icon
- Coach avatar: 28×28px circle, initials, color — per-user

---

## 8. Breadcrumb (shared pattern)

```
Athletes › Mikhail Smirnov › Week 21
```

- `font-size: 11px`
- `color: var(--color-text-muted)`
- `margin-bottom: 12px`
- Links: `color: var(--color-primary)`, `cursor: pointer`, no underline by default, hover → `text-decoration: underline`
- Separator: `ti-chevron-right` icon 12px
- Current page: not a link, `color: var(--color-text-muted)`

---

## 9. Data model (minimum for v1)

```typescript
// ISO week format: "2025-W21"
type WeekId = string;

type AvatarColor = 'blue' | 'green' | 'amber' | 'pink' | 'purple';

interface Athlete {
  id: string;
  name: string;
  sport: string;
  experienceYears: number;
  avatarInitials: string;   // e.g. "MS"
  avatarColor: AvatarColor;
  coachId: string;
}

interface WorkoutSlot {
  id: string;
  weekId: WeekId;
  athleteId: string;
  order: number;            // position within the week: 1, 2, 3...
  title: string;
  exercises: Exercise[];
  status: 'planned' | 'done' | 'skipped';
  completedAt?: string;     // ISO datetime, set by athlete
  rpe?: number;             // 1–10, set by athlete
  athleteNote?: string;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  weightUnit: 'kg' | 'bw' | 'bw_plus_kg';
}

// Aggregate for the athlete card (computed on backend or frontend)
interface AthleteWeekSummary {
  athleteId: string;
  weekId: WeekId;
  totalSlots: number;
  doneSlots: number;
  skippedSlots: number;
  lastActivityAt?: string;  // ISO datetime of last completed workout
  slots: { status: WorkoutSlot['status'] }[];  // for SlotBar
}
```

---

## 10. API endpoints (frontend reference)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/coach/athletes` | List of athletes with AthleteWeekSummary for the current week |
| `GET` | `/api/coach/athletes/:id/weeks/:weekId` | Workout slots for an athlete's week |
| `GET` | `/api/coach/athletes/:id/weeks` | Week history (used on the copy screen) |
| `POST` | `/api/coach/athletes/:id/weeks/:weekId/copy-from/:sourceWeekId` | Copy slots from source week into target week |
| `POST` | `/api/workout-slots` | Create a slot |
| `PATCH` | `/api/workout-slots/:id` | Edit a slot |
| `DELETE` | `/api/workout-slots/:id` | Delete a slot |

---

## 11. Implementation plan (for Claude Code)

### Phase 1 — Foundation
1. Add new CSS tokens to `colors.css` (section 1.2)
2. Build `<SlotBar>` component (section 3.2)
3. Build `<StatusBadge>` component (section 3.2, status table)
4. Build `<RpeChip>` component (section 4.5)

### Phase 2 — Athletes list
5. Build `<AthleteCard>` component (section 3.2)
6. Assemble the `/coach/athletes` screen (section 3.1)

### Phase 3 — Weekly plan
7. Build `<WeekNav>` component (section 4.3)
8. Build `<WorkoutSlotCard>` component (section 4.4)
9. Assemble the `/coach/athletes/:id/week/:weekId` screen (section 4.1)

### Phase 4 — Editing
10. Implement the Add / Edit workout side panel (section 6)
11. Wire up the form to the API

### Phase 5 — Copy week
12. Build `<WeekHistoryCard>` component (section 5.3)
13. Assemble the `/coach/athletes/:id/week/:weekId/copy` screen (section 5.1)
14. Wire up the copy logic (API call + redirect)

---

*This document is ready for handoff to Claude Code. The athlete module spec is a separate file: ATHLETE_DESIGN_SPEC.md.*
