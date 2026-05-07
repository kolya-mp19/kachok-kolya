# Domain types

TypeScript `type` aliases for all domain objects used in UI state.
Examples: Athlete, Attempt, FormulaId, CoefficientsResult.

Rules:
- Use `type`, not `interface`, for local domain structures (per AGENTS.md root rule).
- No runtime code here — types only.
- Every type used in more than one file must be defined here.
