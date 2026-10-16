# CapacitorTextToSpeech (OutSystems ODC)

Reference source for the **CapacitorTextToSpeech** OutSystems Developer Cloud
(ODC) Mobile Library — a wrapper around
[`@capacitor-community/text-to-speech@3.0.0`](https://github.com/capacitor-community/text-to-speech)
pinned exactly, plus the Studio build instructions and the test suite that
validates it. This repo accompanies the Forge submission and article for this
component.

It is **not** an installable OutSystems package by itself — ODC mobile
libraries and apps are built in ODC Studio, not from source files. This repo
exists so the JavaScript that runs inside the library's client actions is
readable, versioned, and testable outside of Studio.

## What's here

- **`reference/js-nodes/`** — the exact JavaScript bodies pasted into each ODC
  JavaScript node (`Speak`, `StopSpeaking`, `OpenInstall`,
  `GetSupportedLanguages`, `GetSupportedVoices`, `IsLanguageSupported`, and the
  Block's `OnReady`/`OnDestroy`). These are the single source of truth: the
  same code pasted into the JavaScript nodes in Studio and run under the test
  suite.
- **`tests/`** — a Vitest + fast-check suite that runs the files above exactly
  as ODC would (same `$parameters`/`$resolve`/`$actions` calling convention),
  against a mock of the native plugin that reproduces its real iOS quirks
  (e.g. a cancelled `speak()` call resolves rather than rejects). Eight of the
  30 tests only check that these files match design.md and the build sheet.
- **`docs/design.md`** — the design: architecture, the Block-vs-Logic-tab
  split, every JS node with its contract, and the correctness properties the
  tests check.
- **`docs/requirements.md`** — the detailed acceptance criteria.
- **`docs/studio-build-sheet.md`** — step-by-step instructions for building
  this library and a consuming app by hand in ODC Studio. Any asset/portfolio
  key specific to the original author's tenant has been redacted; substitute
  your own when you create the assets in your tenant.
- **`docs/tasks.md`** — the implementation plan the build followed, kept for
  context on *why* things are structured the way they are.
- **`docs/run-log.md`** — the real, timestamped build log: the dead ends hit
  along the way (e.g. the OutSystems MCP/Mentor tooling cannot create or load
  a Mobile Library or Mobile app — that build step has to happen by hand in
  ODC Studio), the bugs found and fixed before and during on-device testing,
  and the on-device validation results. Kept so other builders can see what
  actually went wrong and why the design ended up the way it did, not just the
  polished result. Any OutSystems tenant-specific asset key, portfolio key, or
  Mentor session/run ID has been redacted (replaced with `<REDACTED...>`
  placeholders) — those identify the original author's private tenant and
  aren't needed to follow the log.

## Steering files

`.kiro/steering/` holds the working rules this build followed in Kiro, kept
here so the reasoning behind the repo is visible, not just the result.

- **`odc-mobile-rules.md`** is always loaded. It is an eleven-item pre-flight
  checklist covering assets, Public elements, Blocks and events, lifecycle,
  and JavaScript nodes. Each rule in it replaced an instruction that turned
  out to be impossible or buggy in ODC, so it is worth reading before
  changing anything in `reference/js-nodes/` or the build sheet.
- **`outsystems-authoring.md`** sets out the convention for handing a
  Structure to Studio: always as a paste-ready sample JSON object for
  Studio's "Add Structure from JSON," plus a type table, rather than a
  schema description.

## Decisions

See `docs/decisions/` for the design decision records, including why the
Public actions live on the Logic tab rather than inside the Block.

## Links

- [Capacitor Text To Speech (ODC) on the Forge](https://www.outsystems.com/forge/component-overview/25846/capacitor-text-to-speech-odc)
- [Text To Speech Demo (ODC) on the Forge](https://www.outsystems.com/forge/component-overview/25847/text-to-speech-demo-odc)

## Why ODC Mobile Library content can't just be "installed" from this repo

A Capacitor plugin wrapper in ODC must be a **Mobile Library** (not a reactive
library). Extensibility configurations, which pin the native plugin version,
only exist on mobile libraries. A library's kind is fixed at creation, and ODC
mobile libraries and apps are created and built in ODC Studio; there is no
file-based or CLI-based way to create or populate one.
That's why this repo is reference source plus a build sheet, rather than a
`.zip` or module you drop into Studio.

See `docs/studio-build-sheet.md` for the exact steps, and `docs/design.md` for
the reasoning behind the architecture (in particular, why the Public actions
and the event-raising Block are split the way they are).

## Testing

These tests run the JavaScript in reference/js-nodes/ against a mock of the
native plugin. They do not test the library inside ODC. The library and the
demo app were built by hand in ODC Studio, with each JavaScript body pasted
from the build sheet, and then checked on a physical iPhone (all seven
on-device scenarios in docs/design.md passed). Nothing automatically checks
that the nodes in Studio still match these files, so if you change a file
here, update the node in Studio too.

```bash
npm install
npm test
```

The suite is self-contained: it loads each file in `reference/js-nodes/`
directly and runs it against a mocked `window.CapacitorPlugins.TextToSpeech`.
No OutSystems tooling or network access is required.

This suite is the 30 tests from the rebuild. The 39-test suite from the first
build is not included.

## Platform notes (iOS, v3.0.0)

- `Rate` is clamped by iOS to `0.0`–`1.0` (its own default is `~0.5`, so `1.0`
  is iOS's *maximum* speed).
- `Pitch` is clamped to `0.5`–`2.0` (default `1.0`).
- `Volume` is clamped to `0.0`–`1.0`, and is only a multiplier on the device's
  **current system/media volume** — it cannot exceed or override the user's
  physical volume setting.
- A cancelled `speak()` call **resolves** on iOS; it does not reject. The
  queue/drain logic in `Speak.js` accounts for this.
- The default `Category` (`"ambient"`) is muted by the iPhone's silent switch;
  `"playback"` is not.

## License

Add a `LICENSE` file appropriate for your Forge submission before publishing.
This repo wraps `@capacitor-community/text-to-speech`, which has its own
license — check it's compatible with how you intend to distribute this
component.
