# Coefficient calculations

Pure functions implementing Wilks, IPF GL, DOTS, Schwartz/Malone formulas.
No React, no side effects, no imports from components or hooks.

Rules:
- Each formula in its own file, e.g. wilks.ts, dots.ts, ipfgl.ts.
- All functions must be unit-testable without a browser.
- Accept bodyweight (kg) and total (kg), return number | null.
- Treat non-positive or NaN inputs as null (no throws).
