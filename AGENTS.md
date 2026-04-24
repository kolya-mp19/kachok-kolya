<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Agent Guide

## Scope
- This repository is a client-side strength coefficient calculator built on Next.js App Router.
- Core page is `src/app/page.tsx`, styles are in `src/app/page.module.css`.

## Product Expectations
- UI language is Russian by default.
- Ranking updates immediately after input changes.
- Athlete ranking is based on computed score from best valid attempt.
- Users can select calculation formula (Wilks, IPF GL, DOTS, Schwartz/Malone).

## Coding Rules
- Prefer focused, minimal edits over large refactors.
- Keep business logic in small typed helper functions.
- Avoid `any`; keep strict TypeScript-friendly updates.
- Do not add dependencies unless clearly necessary.
- Keep naming explicit:
  - `camelCase` for variables/functions
  - `PascalCase` for types/components
  - boolean flags start with `is/has/can` where applicable.
- Prefer `type` aliases for local domain structures used in UI state.
- Avoid duplicated logic; extract shared calculations into pure functions.

## Form and Validation Rules
- Numeric fields must accept both comma and dot decimals.
- Treat empty/invalid/non-positive values as missing data.
- Keep incomplete athletes visible in table with placeholders rather than crashing logic.
- When changing data model fields, update:
  - initial state,
  - add/remove/update handlers,
  - derived calculations (`useMemo`),
  - table rendering.

## Styling Rules
- Reuse existing CSS module patterns and color palette.
- Keep control styles consistent across `input` and `select`.
- Maintain responsive behavior for mobile (`max-width: 768px`).
- New UI controls must match existing button/select/input visual language.
- Keep layout changes mobile-safe; avoid horizontal overflow in forms.
- Prefer adding classes over inline styles.

## UX Rules
- Do not hide important actions behind hover-only interactions.
- Collapsible content must keep entered data intact.
- Sorting/ranking behavior must remain predictable after UI changes.
- Text labels should be concise and user-facing (no technical wording).

## Testing and Verification
- After substantive edits, check lints for changed files.
- If dev server is running, verify affected flows manually:
  - add athlete,
  - edit bodyweight and attempts,
  - change formula,
  - collapse/expand athlete card,
  - confirm ranking updates correctly.
- If something cannot be verified locally, state it explicitly in the final report.

## Commit Message Convention
- Use concise, intention-first messages.
- Recommended format:
  - `feat: ...` for new capabilities
  - `fix: ...` for bug fixes/regressions
  - `refactor: ...` for internal cleanups without behavior changes
  - `style: ...` for visual-only changes
- Keep subject line in imperative mood and under ~72 chars when possible.

## Delivery Checklist
- Run lint diagnostics for changed files after substantive edits.
- Preserve existing features unless explicitly asked to remove them.
- Keep UI state durable (e.g., collapse toggles should not clear form data).
