# ATHLETE_DESIGN_SPEC_EN.md
# Training Planner — Athlete Module

> This document describes the UX/UI of the athlete module for handoff to Claude Code.
> The coach module is covered in a separate file: COACH_DESIGN_SPEC_EN.md.
> Version: v1.0 · May 2025

---

## 1. Project context

### 1.1 Existing tokens (use only these)

All colors come exclusively from the project's `colors.css`. No new hex values.

```css
--color-bg-page-start, --color-bg-page-end
--color-surface, --color-surface-raised
--color-surface-table-header, --color-surface-highlight
--color-text-heading, --color-text-body
--color-text-label, --color-text-muted, --color-text-placeholder
--color-border, --color-border-input, --color-border-row
--color-focus
--color-primary, --color-primary-text
--color-danger-bg, --color-danger-text
--color-ghost-bg
--color-shadow-card, --color-shadow-btn
--color-overlay
```

### 1.2 Tokens added by the coach module (already in colors.css)

These were introduced in COACH_DESIGN_SPEC_EN and are available to the athlete module as well:

```css
/* Status */
--color-status-done-bg, --color-status-done-text, --color-status-done-border
--color-status-planned-bg, --color-status-planned-text, --color-status-planned-border
--color-status-warn-bg, --color-status-warn-text, --color-status-warn-border

/* RPE */
--color-rpe-easy-bg, --color-rpe-easy-text   /* RPE 1–3 */
--color-rpe-mid-bg,  --color-rpe-mid-text    /* RPE 4–6 */
--color-rpe-hard-bg, --color-rpe-hard-text   /* RPE 7–10 */

/* Slot bar */
--color-slot-done, --color-slot-planned, --color-slot-empty
```

### 1.3 New tokens to add for the athlete module

Append under `/* --- Athlete --- */` in `colors.css`:

```css
/* --- Athlete --- */
--color-set-done-bg:    #f0fdf4;   /* completed set row — background tint */
--color-set-done-text:  #15803d;   /* completed set row — text */
--color-history-bg:     #f8fafc;   /* past-week card background */
--color-history-border: #e2e8f0;   /* past-week card border */
```

### 1.4 Components reused from coach module

| Component | Where reused |
|---|---|
| `<SlotBar>` | Athlete header (current week progress) |
| `<StatusBadge>` | Slot status in the feed |
| `<RpeChip>` | Completed exercise and workout summary display |
| `<WeekNav>` | Week switcher on the main screen |

### 1.5 New components to add to the ui-kit

| Component | Description |
|---|---|
| `<WorkoutFeedCard>` | Collapsed past-week card shown in the history feed |
| `<ActiveSlotCard>` | Expandable card for completing a current-week workout |
| `<ExerciseSetTable>` | Interactive set-by-set table with actual weight/reps inputs and per-set RPE |
| `<RpeScale>` | 1–10 tap scale for rating difficulty (used for both exercise and full workout) |
| `<WorkoutSummaryCard>` | Read-only completed workout card (past weeks) |

---

## 2. Information architecture — athlete module

```
/athlete
├── /                              ← main feed (current week + history)
│   └── ?week=2025-W20             ← past week in read-only mode (query param)
└── /workout/:slotId               ← active workout screen (in-progress completion)
```

### Role model

- A user authenticated with the `athlete` role sees only these routes.
- The athlete sees only their own data — no other athletes' plans are accessible.
- No role switching in the UI.

---

## 3. Screen 1 — Main feed (`/athlete/`)

### 3.1 Layout

```
┌────────────────────────────────────────────────────┐
│ TOPBAR: logo · spacer · role label · athlete avatar│
├────────────────────────────────────────────────────┤
│ ATHLETE HEADER CARD                                │
│   Avatar · Name · Coach · week badge · SlotBar     │
├────────────────────────────────────────────────────┤
│ WEEK NAV: [<] Week NN · dd–dd Mon YYYY [>]         │
├────────────────────────────────────────────────────┤
│ ── CURRENT WEEK (if weekId = current) ──           │
│   ActiveSlotCard × N  (expanded / collapsible)     │
│                                                    │
│ ── PAST WEEK (if weekId = past) ──                 │
│   WorkoutSummaryCard × N  (read-only)              │
├────────────────────────────────────────────────────┤
│ HISTORY SECTION (always visible, below current wk) │
│   LABEL: "Previous weeks"                          │
│   WorkoutFeedCard × 2–3  (collapsed, tappable)     │
└────────────────────────────────────────────────────┘
```

**Page background:** `linear-gradient(135deg, var(--color-bg-page-start), var(--color-bg-page-end))`

**Max content width:** 720px, centered.

### 3.2 Athlete Header Card

Sticky card at the top (below the topbar) giving the athlete a quick overview of the current week.

```
┌──────────────────────────────────────────────────┐
│ [Avatar 40px]  First Last              [2 / 3]   │
│                Coach: Alex Sokolov · week 21      │
│                                                   │
│  ▬▬▬▬▬▬▬▬  ▬▬▬▬▬▬▬▬  ░░░░░░░░   ← SlotBar       │
└──────────────────────────────────────────────────┘
```

Styles:
- `background: var(--color-surface)`
- `border: 0.5px solid var(--color-border)`
- `border-radius: 14px`
- `padding: 14px 16px`
- `margin-bottom: 14px`
- Not sticky — scrolls with the page

Avatar: 40×40px circle, initials, color from athlete model (same set as coach module).

Coach line: `ti-clipboard-list` icon + "Coach: Name · week NN", `font-size: 11px`, `color: var(--color-text-muted)`.

StatusBadge top-right: shows `K / N done` for current week, or `week complete` when all slots are done.

SlotBar: same component as coach module, reflects current-week slot statuses.

### 3.3 WeekNav

Same `<WeekNav>` component as coach module.

```
[<btn]  Week 21 · 19–25 May 2025  [>btn]
```

- Navigating to a past week switches the slot list to read-only `<WorkoutSummaryCard>` view.
- Navigating forward past the current week is **disabled** (no future plans visible to athlete).
- URL updates to `?week=2025-W20` on navigation (no full page reload).

### 3.4 Current week — ActiveSlotCard

One card per workout slot. Slots are listed in order (1, 2, 3).

**Three visual states:**

| State | Description |
|---|---|
| `done` | Collapsed, green border, shows completion date + RPE chips |
| `pending` | Expanded by default if it's the next uncompleted slot; otherwise collapsed |
| `collapsed-pending` | All pending slots except the next one start collapsed |

**Collapsed state (done):**

```
┌────────────────────────────────────────────────────┐
│ [●] Session 2 — Bench / Back    ✓ Thu 22 May       │
│     [RPE easy: 5]  [workout RPE: 6]    [▸ expand]  │
└────────────────────────────────────────────────────┘
```

- `border: 0.5px solid var(--color-status-done-border)`
- Num-circle: green (`--color-status-done-bg` / `--color-status-done-text`)
- Click anywhere on header → expands to read-only detail view
- `ti-chevron-down` / `ti-chevron-up` toggle icon on the right

**Collapsed state (pending, not next):**

```
┌────────────────────────────────────────────────────┐
│ [○] Session 3 — Deadlift              [pending]    │
│     2 exercises · choose your day        [▸ start] │
└────────────────────────────────────────────────────┘
```

- Default border color
- `[▸ Start]` button → navigates to `/athlete/workout/:slotId`

**Expanded state (pending, active — next uncompleted slot):**

```
┌────────────────────────────────────────────────────┐
│ [○] Session 3 — Deadlift           [pending] [2px] │
├────────────────────────────────────────────────────┤
│  Deadlift         5 sets × 3 reps · 160 kg         │
│  Pause squat      4 sets × 4 reps · 100 kg         │
├────────────────────────────────────────────────────┤
│               [▶ Start workout →]                  │
└────────────────────────────────────────────────────┘
```

- `border: 1.5px solid var(--color-primary)` (2px accent — same exception as coach spec)
- Exercise list is a simple read-only preview (name + plan params), not the interactive table
- "Start workout" button: `btn-primary`, full width, navigates to `/athlete/workout/:slotId`

### 3.5 History section

Always rendered below the current-week slots, separated by a section label.

```
LABEL: "Previous weeks"

WorkoutFeedCard (Week 20 · 12–18 May)
WorkoutFeedCard (Week 19 · 5–11 May)
WorkoutFeedCard (Week 18 · 28 Apr – 4 May)
```

Show last 3 completed weeks by default. "Show more" link loads older weeks (pagination or infinite scroll — implementation choice).

**WorkoutFeedCard — collapsed (default):**

```
┌────────────────────────────────────────────────────┐
│  Week 20 · 12–18 May          [3/3 ✓]  [▸]        │
│  ▬▬▬▬▬▬  ▬▬▬▬▬▬  ▬▬▬▬▬▬  avg RPE: 6              │
└────────────────────────────────────────────────────┘
```

- `background: var(--color-history-bg)`
- `border: 0.5px solid var(--color-history-border)`
- `border-radius: 14px`
- `padding: 12px 14px`
- SlotBar inside showing all slots as `done` (green)
- Average RPE shown as `avg RPE: N` in muted text
- Click → navigates to `?week=2025-W20` (switches WeekNav to that week, renders `WorkoutSummaryCard` list)

---

## 4. Screen 2 — Active workout (`/athlete/workout/:slotId`)

This is the primary interaction screen. The athlete comes here to log a workout in real time.

### 4.1 Layout

```
┌────────────────────────────────────────────────────┐
│ TOPBAR: [← back] · "Session N — Title" · [⋯ menu] │
├────────────────────────────────────────────────────┤
│ PROGRESS BAR (thin, 4px, top of content area)      │
├────────────────────────────────────────────────────┤
│ ExerciseSetTable × N  (one per exercise)           │
│   each with per-exercise RpeScale at the bottom    │
├────────────────────────────────────────────────────┤
│ WORKOUT NOTE  (single textarea)                    │
├────────────────────────────────────────────────────┤
│ WORKOUT RPE SECTION                                │
├────────────────────────────────────────────────────┤
│ FINISH BUTTON ROW                                  │
└────────────────────────────────────────────────────┘
```

### 4.2 Topbar (workout-specific)

Different from the main topbar:

- Left: `ti-arrow-left` back button → returns to `/athlete/` with a confirmation if workout is in progress
- Center: slot title, e.g. "Session 3 — Deadlift", `font-size: 14px; font-weight: 600`
- Right: `ti-dots` overflow menu with a single option "Abandon workout" (destructive, clears progress)

### 4.3 Progress bar

```
[████████████░░░░░░░░░░░]  sets done / total sets
```

- `height: 4px`
- `background: var(--color-border)` (track)
- Fill: `background: var(--color-primary)`
- `border-radius: 2px`
- Recalculates on every set checkbox toggle
- Counts total set-checkboxes across all exercises

### 4.4 ExerciseSetTable component

One card per exercise in the workout slot.

**Card structure:**

```
┌ exercise-head ──────────────────────────────────────┐
│  Deadlift                  plan: 5 sets × 3 · 160kg │
└─────────────────────────────────────────────────────┘
┌ set table ──────────────────────────────────────────┐
│  Set  │  Weight (kg)  │  Reps  │  ✓                 │
│───────┼───────────────┼────────┼────────────────────│
│   1   │   [  160  ]   │  [ 3 ] │  [✓] ← green       │
│   2   │   [  160  ]   │  [ 3 ] │  [ ]               │
│   3   │   [  160  ]   │  [ 3 ] │  [ ]               │
│   4   │   [  160  ]   │  [ 3 ] │  [ ]               │
│   5   │   [  160  ]   │  [ 3 ] │  [ ]               │
└─────────────────────────────────────────────────────┘
┌ exercise-rpe ───────────────────────────────────────┐
│  How hard was this exercise?                        │
│  [1][2][3][4][5][6][7][8][9][10]   ← RpeScale       │
└─────────────────────────────────────────────────────┘
```

**exercise-head:**
- `padding: 10px 14px`
- `border-bottom: 0.5px solid var(--color-border)`
- `display: flex; align-items: baseline; justify-content: space-between`
- Exercise name: `font-size: 14px; font-weight: 600; color: var(--color-text-heading)`
- Plan hint: `font-size: 11px; color: var(--color-text-muted)` — shows original planned params, always visible as reference

**Set table:**
- `table-layout: fixed; width: 100%`
- Column widths: Set 48px, Weight auto, Reps 72px, ✓ 44px
- Header row: `background: var(--color-surface-table-header)`, `font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; color: var(--color-text-muted)`
- Data rows: `border-bottom: 0.5px solid var(--color-border-row)`, last row no border

**Set row — default:**
- Set number: `color: var(--color-text-muted); font-size: 12px`
- Weight input: pre-filled with planned weight, `width: 64px`, editable number input
- Reps input: pre-filled with planned reps, `width: 40px`, editable number input
- Checkbox: 20×20px, `border-radius: 5px`, `border: 1.5px solid var(--color-border-input)`

**Set row — checked:**
- Row background: `var(--color-set-done-bg)`
- Checkbox: `background: var(--color-status-done-bg); border-color: var(--color-status-done-border)` + `ti-check` icon in `var(--color-status-done-text)`
- Set number and inputs: `color: var(--color-set-done-text)`
- Transition: `background 0.15s ease`

**exercise-rpe:**
- `padding: 10px 14px`
- `background: var(--color-surface-raised)`
- `border-top: 0.5px solid var(--color-border)`
- Label: `font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 8px`
- `<RpeScale>` component (see section 4.5)
- Once set, shows `<RpeChip>` next to the label instead of the full scale (tap chip to re-rate)

**Card-level styles:**
- `background: var(--color-surface)`
- `border: 0.5px solid var(--color-border)`
- `border-radius: 14px`
- `overflow: hidden`
- `margin-bottom: 10px`
- When all sets in the card are checked → `border-color: var(--color-status-done-border)` (green border, same as done slot)

### 4.5 RpeScale component

Used for both per-exercise rating and full-workout rating.

```
[1][2][3][4][5][6][7][8][9][10]
easy              moderate      max
```

**Button styles:**
- `flex: 1; height: 34px`
- `border-radius: 5px`
- `border: 1.5px solid var(--color-border-input)`
- `background: var(--color-surface-raised)`
- `font-size: 12px; font-weight: 600`
- `color: var(--color-text-muted)`
- `cursor: pointer; transition: all 0.1s`
- `hover`: `border-color: var(--color-focus)`

**Selected state — color depends on selected value:**
- Buttons 1–3 selected: `background: var(--color-rpe-easy-bg); border-color: var(--color-status-done-border); color: var(--color-rpe-easy-text)`
- Buttons 4–6 selected: `background: var(--color-rpe-mid-bg); border-color: var(--color-status-warn-border); color: var(--color-rpe-mid-text)`
- Buttons 7–10 selected: `background: var(--color-rpe-hard-bg); border-color: var(--color-status-skipped-border); color: var(--color-rpe-hard-text)`
- All buttons up to and including the selected value get the selected style (filled range, not just one button)

**Hint row below buttons:**
- `display: flex; justify-content: space-between`
- `font-size: 10px; color: var(--color-text-muted); margin-top: 5px`
- Labels: "easy" (left), "moderate" (center), "max effort" (right)

### 4.6 Workout note

Single textarea at the bottom of the workout, above the workout RPE section.

```
┌────────────────────────────────────────────────────┐
│  Note (optional)                                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ e.g. "Deadlift felt heavy, dropped last set" │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

- Section label: `font-size: 11px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px`
- `textarea`: `width: 100%; min-height: 72px; resize: none`
- Styles from existing ui-kit: `border: 1px solid var(--color-border-input)`, focus → `border-color: var(--color-focus)`, `background: var(--color-surface-raised)`, `border-radius: 10px`, `padding: 10px 12px`, `font-size: 13px`
- Placeholder: `color: var(--color-text-placeholder)`
- One note per workout — not per exercise, not per set

### 4.7 Workout RPE section

Appears after the note, before the finish button. Rates the whole workout session.

```
┌────────────────────────────────────────────────────┐
│  How hard was the overall workout?                 │
│  [1][2][3][4][5][6][7][8][9][10]                   │
│  easy              moderate          max effort     │
└────────────────────────────────────────────────────┘
```

- Same `<RpeScale>` component as exercise-level rating
- Section label: `font-size: 13px; font-weight: 600; color: var(--color-text-heading); margin-bottom: 10px`
- Wrapped in a card: `background: var(--color-surface); border: 0.5px solid var(--color-border); border-radius: 14px; padding: 14px 16px`

### 4.8 Finish button row

```
┌────────────────────────────────────────────────────┐
│  [Postpone]          [✓ Complete workout →]        │
└────────────────────────────────────────────────────┘
```

- Row: `display: flex; gap: 10px; margin-top: 6px; padding-bottom: 24px`
- "Postpone" (`ti-clock`): `btn-ghost`, `flex: 0 0 auto` — saves current inputs without marking as done, returns to feed
- "Complete workout" (`ti-circle-check`): `btn-primary`, `flex: 1`, `justify-content: center`

**"Complete workout" enabled condition:**
- At least one set is checked AND workout RPE is set
- Otherwise button is `disabled`, `opacity: 0.5`, `cursor: default`
- Tooltip or inline hint when disabled: `font-size: 11px; color: var(--color-text-muted); text-align: center; margin-top: 6px` — "Check at least one set and rate the workout to finish"

**On complete:**
1. PATCH `/api/workout-slots/:id` with `{ status: 'done', completedAt: now, rpe: workoutRpe, athleteNote, sets: [...] }`
2. Redirect to `/athlete/` with the completed slot now shown as done (green) in the feed

---

## 5. Screen 3 — Past week view (`/athlete/?week=2025-W20`)

Read-only. Accessed by navigating WeekNav backward or tapping a WorkoutFeedCard in the history section.

### 5.1 Layout difference from current week

- WeekNav shows the past week label; forward navigation stops at the current week
- Instead of `<ActiveSlotCard>`, render `<WorkoutSummaryCard>` × N
- No "Start workout" or "Complete workout" buttons
- A read-only banner at the top of the slot list:

```
┌────────────────────────────────────────────────────┐
│  [i]  Past week — read only                        │
│       Switch to the current week to log workouts.  │
└────────────────────────────────────────────────────┘
```

Banner styles:
- `background: var(--color-surface-raised)`
- `border: 0.5px solid var(--color-border)`
- `border-radius: 10px`
- `padding: 10px 14px`
- `font-size: 12px; color: var(--color-text-muted)`
- `ti-info-circle` icon, `font-size: 14px; margin-right: 8px`

### 5.2 WorkoutSummaryCard component

Read-only version of a completed workout. Always fully expanded.

```
┌ summary-head ───────────────────────────────────────┐
│ [●] Session 1 — Squat / Bench     ✓ Tue, 13 May    │
│     [RPE exercise avg: 6]  [workout RPE: 7]         │
├─────────────────────────────────────────────────────┤
│ exercise-summary × N                                │
├─────────────────────────────────────────────────────┤
│ "athlete note text..."  (if note exists)            │
└─────────────────────────────────────────────────────┘
```

**summary-head:**
- Same structure as `WorkoutSlotCard` slot-head in coach module
- Green num-circle, green border on the card
- Completion date: `ti-circle-check` (green) + "Done dd Mon"
- RPE chips: `<RpeChip>` for exercise average RPE and workout RPE, side by side

**exercise-summary row (per exercise):**
- `display: flex; align-items: flex-start; gap: 12px; padding: 8px 14px; border-bottom: 0.5px solid var(--color-border-row)`
- Name: `font-size: 13px; font-weight: 500; flex: 1`
- Actual sets summary: e.g. "5 × 3 · 160 kg" — `font-size: 12px; color: var(--color-text-muted)` (shows actual recorded values, not plan)
- If actual differed from plan, show both: `font-size: 11px` — "plan: 5×3 · 160 kg → actual: 4×3 · 155 kg" with plan in muted and actual in body color
- `<RpeChip>` for this exercise at the right

**Note row (if note exists):**
- `padding: 10px 14px`
- `background: var(--color-surface-raised)`
- `border-top: 0.5px solid var(--color-border)`
- `font-size: 12px; font-style: italic; color: var(--color-text-muted)`
- `ti-message` icon, `font-size: 13px; margin-right: 6px`

---

## 6. Topbar (shared across all athlete screens)

```
┌────────────────────────────────────────────────────┐
│  🏋 TrainWeek  [spacer]  [Athlete label]  [Avatar] │
└────────────────────────────────────────────────────┘
```

Same structure as coach topbar. Differences:
- Role label reads "Athlete" with `ti-run` icon (instead of `ti-user`)
- Avatar shows the athlete's own initials and color

On the active workout screen (`/athlete/workout/:slotId`) the topbar is replaced by the workout-specific topbar (see section 4.2).

---

## 7. Data model (athlete-side additions)

These extend the models defined in COACH_DESIGN_SPEC_EN.

```typescript
// Actual set logged by the athlete (stored inside WorkoutSlot)
interface LoggedSet {
  setNumber: number;
  actualWeight: number;
  actualReps: number;
  done: boolean;
}

// Exercise-level data logged by athlete
interface LoggedExercise {
  exerciseId: string;       // references Exercise.id from the slot
  sets: LoggedSet[];
  exerciseRpe?: number;     // 1–10, per-exercise rating
}

// Extends WorkoutSlot (fields written by the athlete)
// These fields are already defined in WorkoutSlot in the coach spec:
//   completedAt, rpe (workout-level), athleteNote
// New field:
interface WorkoutSlotAthleteData {
  loggedExercises: LoggedExercise[];   // actual set-by-set data
  workoutRpe?: number;                  // 1–10, overall workout rating (= WorkoutSlot.rpe)
  athleteNote?: string;                 // single note for the whole workout
}

// For the history feed
interface WeekHistorySummary {
  weekId: WeekId;
  label: string;            // "Week 20 · 12–18 May"
  totalSlots: number;
  doneSlots: number;
  avgRpe?: number;          // average of all workout-level RPEs that week
  slots: { status: WorkoutSlot['status'] }[];  // for SlotBar
}
```

---

## 8. API endpoints (frontend reference)

| Method | URL | Description |
|---|---|---|
| `GET` | `/api/athlete/me` | Current athlete profile + current week summary |
| `GET` | `/api/athlete/weeks/:weekId` | Workout slots for a specific week |
| `GET` | `/api/athlete/weeks` | Week history list (last N weeks, for feed) |
| `GET` | `/api/athlete/workout-slots/:slotId` | Single slot detail (for active workout screen) |
| `PATCH` | `/api/athlete/workout-slots/:slotId/progress` | Save in-progress set data (postpone) |
| `PATCH` | `/api/athlete/workout-slots/:slotId/complete` | Mark slot as done with all logged data |

---

## 9. UX behaviours and edge cases

### 9.1 Auto-fill on set check

When the athlete checks a set checkbox, weight and reps inputs are pre-filled with the **planned** values if they haven't been edited yet. This avoids manual re-entry for sets done at plan weight.

### 9.2 Input persistence

Set inputs are persisted to local state immediately on change. On "Postpone", they are also sent to `PATCH /progress` so the athlete can return and continue.

### 9.3 No skipping workouts

The athlete cannot mark a slot as skipped. A slot remains `planned` until it is either completed or the week ends without action. Tracking of uncompleted weeks is the coach's concern (visible in the coach module).

### 9.4 Navigating away mid-workout

If the athlete taps back (`ti-arrow-left` in workout topbar) while sets are checked but workout is not completed:
- Show a confirmation: "Your progress will be saved as a draft. You can continue later."
- Two options: "Leave and save draft" (calls PATCH `/progress`) and "Stay"
- Confirmation is a simple inline banner below the topbar, not a blocking modal

### 9.5 All sets done, RPE not set

Progress bar hits 100%. "Complete workout" button remains disabled. An inline hint appears:
```
"Rate the workout difficulty to finish"
```
`font-size: 11px; color: var(--color-text-muted); text-align: center; margin-top: 8px`

### 9.6 Past week — no plan

If the athlete navigates to a past week with no plan (coach never created one):
```
┌────────────────────────────────────────────────────┐
│  [○]  No training plan for this week               │
│       Your coach hadn't set a plan for week NN.    │
└────────────────────────────────────────────────────┘
```
Same info-banner style as section 5.1.

---

## 10. Implementation plan (for Claude Code)

### Phase 1 — Foundation (if not already done from coach spec)
1. Confirm new tokens from section 1.3 are in `colors.css`
2. Build `<RpeScale>` component (section 4.5) — used in two places

### Phase 2 — Main feed
3. Build `<WorkoutFeedCard>` (section 3.5) — collapsed history card
4. Build `<ActiveSlotCard>` (section 3.4) — all three states
5. Assemble the `/athlete/` screen with athlete header, WeekNav, slot list, history section (section 3.1)

### Phase 3 — Active workout screen
6. Build `<ExerciseSetTable>` (section 4.4) — set rows, per-exercise RPE
7. Build workout note textarea section (section 4.6)
8. Build workout RPE section (section 4.7)
9. Build finish button row with enabled/disabled logic (section 4.8)
10. Assemble the `/athlete/workout/:slotId` screen (section 4.1)
11. Wire up PATCH `/progress` (postpone) and PATCH `/complete`

### Phase 4 — Past week view
12. Build `<WorkoutSummaryCard>` (section 5.2)
13. Assemble past-week mode: read-only banner + summary cards (section 5.1)
14. Wire WeekNav query param (`?week=`) to week data fetching

---

*This document is ready for handoff to Claude Code.*
*Coach module spec: COACH_DESIGN_SPEC_EN.md*
