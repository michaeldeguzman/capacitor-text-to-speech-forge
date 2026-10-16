---
inclusion: always
---

# Tech constraints

- ODC on MABS 12.1, Capacitor runtime, iOS-only testing (no Android device).
- Capacitor plugin pinned to @capacitor-community/text-to-speech@3.0.0
  — NOT latest (8.0.2). v3.0.0 has no `queueStrategy` option, no
  `onRangeStart` event, and no `addListener`; do not use those.
- Plugin access pattern in JS nodes:
  `const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;`
  followed by an `if (!CapTTS)` guard. No optional chaining, no fallback onto
  other globals.
- JS node data flow: `$parameters` for inputs and outputs, `$resolve()` with no
  arguments, primitives only (lists via JSON Text then JSON Deserialize), and
  numeric inputs converted with `toNumber()` or `Number()`.
- JS cannot fire Block Events. Public (Logic-tab) actions signal the Block with
  window events (`ctts:speakstart`, `ctts:speakend`, `ctts:error`); the Block's
  On Ready listeners call its helper actions through `$actions`.
- Only the drain loop dispatches `ctts:speakend`. Stop and Flush mark the
  in-flight item cancelled, because a cancelled `speak()` resolves on iOS.
- JS nodes must call `$resolve()` promptly; async work continues in the
  background after `$resolve()`.
- Local tests: Node 24, vitest 2.1.9, fast-check 3.23.2 (`npm test`).
