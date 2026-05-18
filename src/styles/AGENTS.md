# CSS Variables — Rules for AI Agents

## Single source of truth

- All color variables live in `src/styles/variables.css` — nowhere else.
- Loaded globally via `src/app/globals.css`. CSS modules use variables without any import.
- Never define a color variable inside a CSS module or component file.

## Naming — semantic, not visual

Variable names must describe **what the color is for**, not what it looks like.

| Bad — visual | Good — semantic |
|---|---|
| `--blue-500` | `--color-primary` |
| `--gray-dark` | `--color-text-heading` |
| `--light-red` | `--color-danger-bg` |
| `--hex-3b82f6` | `--color-focus` |
| `--color-almost-white` | `--color-surface-raised` |

## Naming pattern

```
--color-{category}-{modifier?}
```

Categories in use: `text`, `surface`, `border`, `bg`, `primary`, `danger`, `ghost`, `focus`, `shadow`.

Examples:
- `--color-text-heading` — main heading text
- `--color-text-muted` — secondary/description text
- `--color-surface` — primary white surface
- `--color-surface-raised` — elevated card background
- `--color-border-input` — form control border
- `--color-shadow-card` — drop shadow on main panel

## Using variables in CSS modules

```css
/* Correct */
.card {
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  color: var(--color-text-body);
}

/* Wrong — hardcoded color */
.card {
  background: #f8fbff;
  border: 1px solid #d6deec;
  color: #1f2937;
}
```

## Adding a new color

1. Check `variables.css` first — reuse an existing variable if the semantic meaning fits.
2. If no match exists, add a new entry to `variables.css` with a semantic name.
3. Never create a variable that duplicates an existing one with a different name.

## Theming

- Themes remap semantic variables to new actual values — they do not rename variables.
- Components never change; only the variable values change per theme.

```css
/* Dark theme example — same variable names, different values */
[data-theme="dark"] {
  --color-surface: #1a1a2e;
  --color-text-heading: #f1f5f9;
}
```
