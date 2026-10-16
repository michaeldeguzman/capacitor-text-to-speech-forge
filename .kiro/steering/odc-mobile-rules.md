---
inclusion: always
---

# ODC mobile rules

Hard platform rules for this ODC mobile build (MABS 12.1, Capacitor, iOS). Every
spec, design, task, and build sheet must follow them. Each one replaced an
instruction that turned out to be impossible or buggy in ODC. When a step depends
on an ODC behavior not listed here, verify it first (the OutSystems docs MCP tool
`mcp_outsystems_docs_search_docs`, forums, or the user working in Studio).

## Pre-flight checklist (run before writing or changing any build step)

1. Is each asset a Mobile Library or a Mobile app, created and built in ODC
   Studio, with no step that has Mentor create, load, edit, or publish it?
2. Is every Public client action on the Logic tab, not inside a Block?
3. Does any Block client action have an Output parameter? It must not.
4. Does any step have a parent screen call a Block's action or read a Block's
   variable? It must not.
5. Does any Logic-tab action try to Trigger Event or call a Block action? It must
   not. Use a window event plus a Block listener.
6. Are the Block, the Public actions, and every structure used in their
   parameters set to **Public = Yes**?
7. In every JS node: inputs as `$parameters.<Name>`, outputs as
   `$parameters.<Name> = value`, `$resolve()` with no arguments, no List or
   Record List output, and numeric inputs converted before use?
8. Are the JS node's own parameters declared, and is an Assign copying each
   output to the client action's output?
9. Is the plugin read guarded:
   `window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null`?
10. Does any cleanup in On Destroy assume it runs before the next screen's On
    Ready? It must not.
11. Is every Structure given to the user as paste-ready JSON (see
    `outsystems-authoring.md`)?

## Assets

- The two assets are a **Mobile Library** (`CapacitorTextToSpeech`) and a **Mobile
  app** (`TextToSpeechDemo`). Never describe either as reactive.
- A library's or app's kind is **fixed at creation** and cannot be converted.
- Both are **created and built in ODC Studio**.
  The MCP/Mentor cannot create or load them (`mentor_load_asset` rejects
  `MobileLibrary`). The MCP is read-only here: `app_list`, `env_apps`, `env_app`.
- A Mobile Library is consumed and tested **only by a Mobile app**.
- `window.CapacitorPlugins.*` exists only in the native Capacitor WebView (MABS
  build), never in Studio preview.

## Public elements

- In a library, **Blocks, client actions, and structures** are shared only when
  **Public = Yes**. A structure must be Public if a Public action or Block uses it.
- Block events have **Is Mandatory**. Set it to No unless the consumer must handle
  the event.

## Blocks, events, and Public actions

- **Public client actions are defined on the Logic tab.** A client action inside a
  Block cannot be Public.
- **A Block's client actions cannot have Output parameters.**
- **A parent screen cannot call a Block's client actions and cannot read its
  variables.** A Block takes Input Parameters and raises Events.
- **Only JS inside a Block can call that Block's actions through `$actions`**, and
  only Block client actions can Trigger Event. JS cannot raise events itself.
- To signal a Block event from a Logic-tab action: dispatch a `window`
  CustomEvent; the Block's On Ready registers a listener that calls a Block helper
  (which Triggers the event); On Destroy removes it.

## Lifecycle

- When navigating, the **target screen's On Initialize, On Ready, and On Render
  run before the old screen's On Destroy** (the old screen is destroyed when the
  transition ends). Global cleanup in On Destroy can remove what the new screen
  just set up. Key per-instance state by an id stored in a Block variable.
- Don't start long-running work (like speech) in a screen's On Ready if the
  previous screen's On Destroy might cancel it.

## JavaScript nodes

- Inputs and outputs are declared on the JS node and accessed through
  `$parameters`. An Assign after the node copies each output to the action output.
- `$resolve()` takes **no arguments**. Call it immediately for fire-and-forget
  work, or after the promise settles when the flow needs the result.
- JS node parameters are **primitives only**. Lists and Record Lists go through
  JSON Text, then **JSON Deserialize**, then **Assign**, with JSON keys matching
  the structure's attribute names.
- **Integer, Text, Boolean** arrive as JS numbers, strings, booleans. **Decimal,
  Currency, Long Integer** can arrive as OutSystems objects with `toNumber()`.
  Convert with
  `(v != null && typeof v.toNumber === "function") ? v.toNumber() : Number(v)`.
- Plugin access:
  `const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;`
  then a single `if (!CapTTS)` guard.

## Plugin facts (@capacitor-community/text-to-speech v3.0.0, iOS source)

- A cancelled `speak()` **resolves**, it does not reject. Mark the in-flight item
  as cancelled before `stop()` to report it correctly.
- `speak()` rejects with "This language is not supported." for an unknown `lang`.
- `getSupportedVoices()` reports `default: false`, `localService: true` for every voice.
- `category: "ambient"` (the default) is muted by the iPhone silent switch.

## Confirmed versus unverified

- Confirmed in ODC docs: `window.CapacitorPlugins`; the JSON Text plus JSON
  Deserialize pattern; `$parameters` and `$actions` scope; Public element rules;
  screen-transition lifecycle order.
- Confirmed in Studio: `GetSupportedLanguages` (JS, JSON Deserialize, Assign); the
  guarded plugin read; a JS node cannot output a List.
- Confirmed from forums only: a parent cannot call a Block's actions; Block actions
  have no return values.
- Confirmed from the plugin's v3.0.0 source: the plugin facts above.
- Confirmed on a physical iPhone (2026-10-14, all 7 on-device scenarios in
  `design.md`): the Block's window listeners calling `$actions.TriggerOn*` after
  the Public action has resolved, including after navigating from a screen to a
  second screen (with its own `TextToSpeechController` Block instance) and back.
  Both the first screen's and the second screen's listeners worked correctly.
- Confirmed on a physical iPhone (2026-10-14): fractional Decimal inputs
  (`Rate = 0.3`, `Pitch = 0.7`) reach the JS node and are correctly coerced by
  `toNumber()`/`Number()` and applied by the plugin (audibly slower rate, lower
  pitch). Also confirmed `Lang = "fr-FR"` plays correctly. No remaining
  unverified items.
