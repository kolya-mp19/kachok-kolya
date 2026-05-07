# App-wide constants

Static data that does not change at runtime: formula identifiers,
display names, weight class lists, default values.

Rules:
- Use `as const` for all constant objects.
- No functions here — only data.
- Export each constant as a named export.
