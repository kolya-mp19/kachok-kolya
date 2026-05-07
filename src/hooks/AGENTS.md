# Custom React hooks

Hooks that encapsulate stateful logic for athletes and coefficients.
Examples: useAthletes (CRUD), useCoefficients (derived ranking).

Rules:
- One hook per file, named useXxx.ts.
- Calculation logic must live in src/lib/calculations — hooks only call it.
- Hooks must not directly manipulate DOM.
