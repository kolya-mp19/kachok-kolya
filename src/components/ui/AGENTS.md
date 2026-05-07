# UI primitives

Reusable, stateless input controls with no business logic.
Each component lives in its own subfolder alongside its CSS Module:
  input/InputField.tsx + input/InputField.module.css
  select/SelectField.tsx + select/SelectField.module.css

Rules:
- Props must be explicitly typed (no implicit any).
- Accept standard HTML input/select attributes via spread or explicit props.
- Visual style must match existing page.module.css language (border-radius, colors, font-size).
- Do not import anything from src/lib or src/hooks here.
