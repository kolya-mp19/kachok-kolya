# Table components

Components that render the summary coefficient table and its rows.
Receives pre-computed data as props — no raw calculations here.

Rules:
- Each component must live in its own subfolder alongside its CSS Module:
  ComponentName/ComponentName.tsx + ComponentName/ComponentName.module.css
- Table must remain readable on mobile (max-width: 768px).
- Ranking column must reflect sort order passed via props.
- Placeholder cells for incomplete athletes must not crash rendering.
