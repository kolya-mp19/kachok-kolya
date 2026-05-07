# Zod schemas

Zod validation schemas corresponding to types in src/types/.
Add schemas here only when runtime validation is actually needed
(e.g., API responses, localStorage reads, form parsing).

Rules:
- Schema name mirrors the type name: Athlete → athleteSchema.
- Infer types from schemas with z.infer<> instead of duplicating types.
- Do not add Zod as a dependency until the first schema is actually needed.
