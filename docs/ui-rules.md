# UI Rules

> Mobile-first is not a preference — it is a hard constraint.
> The primary user is in a gym, holding a phone with one hand, between sets.

---

## Language

**All user-facing text must be in Russian.** No English strings in UI components.

| Applies to | Examples |
|---|---|
| Labels, placeholders, hints | `Пароль`, `Ваше имя`, `Не менее 8 символов` |
| Button text | `Войти`, `Зарегистрироваться`, `Выйти` |
| Navigation links | `Калькулятор`, `Профиль` |
| Section headings | `Личная информация`, `История тренировок` |
| Empty / loading states | `Скоро`, `Загрузка…` |
| Error messages | server error strings passed through from the API |
| `aria-label` attributes | `Закрыть`, `Открыть меню` |

**Exceptions** — keep as-is:
- `Email` — universally understood technical term, no Russian equivalent in common use
- Code identifiers, prop names, comments in source files

---

## Color system

All colors are defined as CSS custom properties in [`src/styles/variables.css`](../src/styles/variables.css).
They are loaded globally via `globals.css` — CSS modules use them without any extra import.

### Rules

- **Never** write a hardcoded color value in a CSS module. Always use a variable.
- **Always** add new colors to `variables.css` first, then reference the variable.
- Use **semantic names** — names that describe what the color is *for*, not what it looks like.

| Correct | Wrong |
|---|---|
| `--color-text-heading` | `--color-gray-900` |
| `--color-primary` | `--color-blue` |
| `--color-border-input` | `--color-light-border` |
| `--color-surface-highlight` | `--color-yellow` |

### Available tokens

| Token | Value | Use |
|---|---|---|
| `--color-bg-page-start` | `#f2f6ff` | Page gradient left edge |
| `--color-bg-page-end` | `#eefaf4` | Page gradient right edge |
| `--color-surface` | `#ffffff` | Primary surface: cards, inputs |
| `--color-surface-raised` | `#f8fbff` | Elevated card background |
| `--color-surface-table-header` | `#eff6ff` | Table header row |
| `--color-surface-highlight` | `#fef9c3` | Leader / highlighted row |
| `--color-text-heading` | `#111827` | h1, h2, input values |
| `--color-text-body` | `#1f2937` | Body text, table cells |
| `--color-text-label` | `#374151` | Form labels |
| `--color-text-muted` | `#4b5563` | Secondary / description text |
| `--color-text-placeholder` | `#6b7280` | Input placeholder |
| `--color-border` | `#d6deec` | Container borders |
| `--color-border-input` | `#c3cede` | Form control borders |
| `--color-border-row` | `#e2e8f0` | Table row dividers |
| `--color-focus` | `#3b82f6` | Focus ring, active border |
| `--color-primary` | `#2563eb` | Primary button background |
| `--color-primary-text` | `#ffffff` | Text on primary button |
| `--color-danger-bg` | `#fee2e2` | Danger button background |
| `--color-danger-text` | `#b91c1c` | Danger button text |
| `--color-ghost-bg` | `#e5e7eb` | Ghost button background |
| `--color-shadow-card` | `rgba(14,42,85,.08)` | Main panel shadow |
| `--color-shadow-btn` | `rgba(15,23,42,.15)` | Button hover shadow |

### Example usage in a CSS module

```css
.card {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
}

.title {
  color: var(--color-text-heading);
}

.input {
  border: 1px solid var(--color-border-input);
  color: var(--color-text-heading);
  font-size: 16px;
}

.input:focus {
  outline: 2px solid var(--color-focus);
}
```

---

## Core principle

Design for 375px first. Add complexity for larger screens after.
Every component that touches UI must work correctly at 375px.

---

## CSS Modules usage

### Correct — mobile-first
```css
/* Base = mobile */
.container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.button {
  width: 100%;
  height: 48px;
}

/* Desktop additions */
@media (min-width: 768px) {
  .container {
    flex-direction: row;
    gap: 24px;
  }

  .button {
    width: auto;
    padding: 0 24px;
  }
}
```

### Wrong — desktop-first
```css
/* Never start with desktop layout */
.container {
  flex-direction: row;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
  }
}
```

---

## Breakpoints

Define in a shared `src/styles/breakpoints.css` or use directly in modules:

| Name | min-width | Use case |
|---|---|---|
| sm | 640px | Large phones landscape |
| md | 768px | Tablets |
| lg | 1024px | Desktop |
| xl | 1280px | Wide desktop |

---

## Component sizing rules

| Element | Mobile minimum | CSS |
|---|---|---|
| Button | height: 48px, width: 100% | Full width on mobile by default |
| Input field | height: 48px, font-size: 16px | 16px prevents iOS auto-zoom |
| Icon button | 44×44px | min-height: 44px; min-width: 44px |
| Card padding | 16px | padding: 16px |
| Section gap | 12px | gap: 12px between interactive elements |
| Bottom nav | 64px | height: 64px + safe area |

---

## Typography

- Body text: minimum 16px — prevents iOS zoom on input focus
- Labels / hints: 14px maximum, never for primary content
- Headings: scale up with media queries

```css
.heading {
  font-size: 1.25rem; /* 20px mobile */
}

@media (min-width: 768px) {
  .heading {
    font-size: 1.5rem; /* 24px desktop */
  }
}
```

---

## Gym-specific UX rules

- **One thumb rule**: all primary actions reachable with right thumb at bottom of screen
- **Fast input**: number inputs must open numeric keyboard

```tsx
// Weight input
<input
  type="number"
  inputMode="decimal"
  pattern="[0-9]*"
  className={styles.input}
  placeholder="kg"
/>

// Reps input
<input
  type="number"
  inputMode="numeric"
  pattern="[0-9]*"
  className={styles.input}
  placeholder="reps"
/>
```

- **No tiny targets**: never place two interactive elements closer than 8px
- **High contrast**: gym lighting varies — ensure contrast ratio 4.5:1 minimum
- **Offline tolerance**: show last known data if request fails, never blank screen

---

## Page layout template

Every page follows this structure on mobile:

```
┌─────────────────────┐
│ Header (sticky)     │  height: 56px, position: sticky, top: 0
├─────────────────────┤
│                     │
│ Main content        │  flex: 1, overflow-y: auto
│                     │  padding-bottom: 80px (clears bottom nav)
│                     │
└─────────────────────┘
│ Bottom nav          │  height: 64px, position: fixed, bottom: 0
└─────────────────────┘
```

```css
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh; /* dvh handles mobile browser chrome */
}

.header {
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 80px;
}

.bottomNav {
  height: 64px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  /* iOS safe area */
  padding-bottom: env(safe-area-inset-bottom);
}
```

---

## Checklist before submitting any UI component

- [ ] Looks correct at 375px width
- [ ] All touch targets ≥ 44×44px
- [ ] No font-size below 16px on inputs and body text
- [ ] Number inputs have inputMode set
- [ ] No hover-only interactions (add :active and :focus states)
- [ ] Works with one thumb (primary actions at bottom or easily reachable)
- [ ] Media queries use min-width (mobile-first), never max-width
