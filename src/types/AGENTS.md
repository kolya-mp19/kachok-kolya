# Domain types

TypeScript `type` aliases for all domain objects used in UI state.
Examples: Athlete, Attempt, FormulaId, CoefficientsResult.

Rules:
- Use `type`, not `interface`, for local domain structures (per AGENTS.md root rule).
- No runtime code here — types only.
- Every type used in more than one file must be defined here.

## Current domain files

- `athlete.ts` — Gender, GenderValue, Athlete, CalculatedAthlete
- `formula.ts` — FormulaType

## How to add new types

1. Identify the domain the type belongs to (athlete, formula, ui, etc.).
2. If a matching domain file exists — add the type there.
3. If no matching file exists — create a new domain file: `{domain}.ts`.
4. Always re-export from `index.ts`.
5. Never define domain types inline in components or hooks —
   always import from `src/types`.

## File naming

One file per domain, kebab-case: `athlete.ts`, `formula.ts`, `calculated-result.ts`.
