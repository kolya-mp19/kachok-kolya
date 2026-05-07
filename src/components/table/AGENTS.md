# Table components

Components that render the summary coefficient table and its rows.
Receives pre-computed data as props — no raw calculations here.

Rules:
- Table must remain readable on mobile (max-width: 768px).
- Ranking column must reflect sort order passed via props.
- Placeholder cells for incomplete athletes must not crash rendering.
