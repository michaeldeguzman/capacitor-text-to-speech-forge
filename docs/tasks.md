# Implementation Plan: CapacitorTextToSpeech

## Overview

This plan builds the `CapacitorTextToSpeech` ODC **Mobile Library** and the `TextToSpeechDemo` **Mobile app** from `design.md` and `requirements.md`. JavaScript bodies, names, defaults, Signal names, and error strings come verbatim from `design.md`. Studio steps are detailed in `studio-build-sheet.md`.

Before writing or changing any step, run the pre-flight checklist in `.kiro/steering/odc-mobile-rules.md`.

### Where the work happens

- **ODC Studio** (by the user): everything inside the mobile library and the demo app, both asset creation, and both publishes. The MCP/Mentor cannot create, load, or publish mobile assets.
- **ODC Portal** (by the user): building the iOS package.
- **Local** (by Kiro): the JS reference files (task 6) and the test suite (tasks 9, 10.1, 11).
- **OutSystems MCP** (by Kiro): read-only checks only (`app_list`, `env_apps`, `env_app`).

### Current tenant state (checked 2026-10-14)

- `CapacitorTextToSpeech` MobileLibrary exists: asset key `<REDACTED>`, portfolio `<REDACTED>`, revision 4. It may contain elements from earlier attempts. Task 1 starts by clearing them.
- `TextToSpeechDemo` does not exist yet. Task 14 creates it.

### Publishing model

Edits to a module are visible to its own later edits, so publish only when another module needs it:

- **Publish Gate #1 (task 12):** the library, after the local test gate (task 11).
- **Publish Gate #2 (task 15):** the demo app, after its screen is wired (task 14).

Wait for each publish to finish before the next dependent step. Never overlap publishes of one module.

### Logging

`.kiro/specs/capacitor-text-to-speech/logs/run-log.md` gets one entry per task event, from the `PostTaskExec` hook and explicit in-task appends. `mentor-transcript.md` records any MCP exchange (secrets redacted). Timestamps are ISO 8601 local time with UTC offset.

## Tasks

- [x] 0. Set up build logging
  - Confirm `logs/run-log.md`, `logs/mentor-transcript.md`, and the hook `.kiro/hooks/run-log-task.json` exist.
  - Append start and finish entries for every task. Timestamp on macOS: `date +%Y-%m-%dT%H:%M:%S%z | sed -E 's/([0-9]{2})([0-9]{2})$/\1:\2/'`.

- [x] 1. Clear the library and set the Extensibility Configuration (Studio)
  - Open `CapacitorTextToSpeech` in ODC Studio. Delete everything left from earlier attempts: Blocks, client actions, structures, and variables. Keep the library itself (its kind is fixed and correct).
  - Set the Extensibility Configuration to the exact JSON in design.md (npm `@capacitor-community/text-to-speech@3.0.0`, no range operators). No permissions are needed.
  - Do not publish yet.
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6_

- [x] 2. Create the TTSVoice structure (Studio)
  - Add Structure from JSON using the paste-ready JSON in `studio-build-sheet.md` Step 2. Confirm the six attribute types. Set **Public = Yes**.
  - _Requirements: 9.1_

- [x] 3. Create the TextToSpeechController Block (Studio)
  - Add Block `TextToSpeechController`, **Public = Yes**. No Input Parameters.
  - Add one local variable `HandlerId` (Text, default `""`).
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4. Define the Block events (Studio)
  - `OnSpeakStart` (no parameters), `OnSpeakEnd` with `Success` (Boolean), `OnError` with `Message` (Text). All **Is Mandatory = No**.
  - _Requirements: 3.1, 3.3, 3.6_

- [x] 5. Create the Block helper client actions (Studio)
  - Client actions of the Block (not Public), each only a Trigger Event.
  - [x] 5.1 `TriggerOnSpeakStart`: no inputs, Trigger Event `OnSpeakStart`. _Requirements: 4.1, 4.4_
  - [x] 5.2 `TriggerOnSpeakEnd`: input `Success` (Boolean), Trigger Event `OnSpeakEnd` mapping `Success`. _Requirements: 4.2, 4.4_
  - [x] 5.3 `TriggerOnError`: input `Message` (Text), Trigger Event `OnError` mapping `Message`. _Requirements: 4.3, 4.4_

- [x] 6. Save the JS-node source as local reference files
  - Create `reference/js-nodes/` with each body verbatim from design.md: `Speak.js`, `StopSpeaking.js`, `OpenInstall.js`, `GetSupportedLanguages.js`, `GetSupportedVoices.js`, `IsLanguageSupported.js`, `OnReady.js`, `OnDestroy.js`.
  - These files are what gets pasted into Studio and what the tests run.
  - _Requirements: 5.1_

- [x] 7. Implement the fire-and-forget Public actions (Studio, Logic tab)
  - Public client actions on the Logic tab, **Public = Yes**, no Output parameters, one JS node each. Paste from `reference/js-nodes/`.
  - [x] 7.1 `Speak`: inputs `Text` (Text, mandatory), `Lang` (`"en-US"`), `Rate` (Decimal, `1.0`), `Pitch` (Decimal, `1.0`), `Volume` (Decimal, `1.0`), `VoiceIndex` (Integer, `-1`), `Category` (`"ambient"`), `QueueMode` (Integer, `1`). The JS node declares the same eight inputs.
    - _Requirements: 6.1 to 6.14, 5.1, 5.2_ · _Validates: Properties 1 to 6, 8, 11, 13_
  - [x] 7.2 `StopSpeaking`: no inputs.
    - _Requirements: 7.1 to 7.6, 5.1, 5.2_ · _Validates: Properties 7, 8, 11_
  - [x] 7.3 `OpenInstall`: no inputs.
    - _Requirements: 11.1 to 11.4, 5.1, 5.2_ · _Validates: Properties 8, 11, 12_

- [x] 8. Implement the query Public actions (Studio, Logic tab)
  - Public client actions on the Logic tab, **Public = Yes**. They dispatch nothing.
  - [x] 8.1 `GetSupportedLanguages`: output `Languages` (Text List). JS (Text output `LanguagesJSON`), JSON Deserialize (`Text List`), Assign.
    - _Requirements: 8.1 to 8.6, 5.3_ · _Validates: Properties 8, 9, 11_
  - [x] 8.2 `GetSupportedVoices`: output `Voices` (`TTSVoice` List). JS (Text output `VoicesJSON`), JSON Deserialize (`TTSVoice List`), Assign.
    - _Requirements: 9.2 to 9.7, 5.3_ · _Validates: Properties 8, 10, 11_
  - [x] 8.3 `IsLanguageSupported`: input `Lang`, output `Supported` (Boolean). JS (Text input `Lang`, Boolean output `Supported`), Assign.
    - _Requirements: 10.1 to 10.4, 5.3_ · _Validates: Properties 8, 9, 11_

- [x] 9. Author the test suite (local)
  - [x] 9.1 Harness: in the existing vitest + fast-check project, load each reference file as the body of an async function taking `$parameters`, `$resolve`, `$actions`. Set `window` to an `EventTarget` (Node 24 has `EventTarget` and `CustomEvent`) with recorded `dispatchEvent`, plus a mock `CapacitorPlugins.TextToSpeech` with controllable promises. Reset globals between runs. At least 100 runs per property, tagged `Feature: CapacitorTextToSpeech, Property N: {text}`.
  - [x] 9.2 Property 1: Add preserves FIFO order. **Validates: 6.6**
  - [x] 9.3 Property 2: Flush clears, cancels current, stops, enqueues. **Validates: 6.5**
  - [x] 9.4 Property 3: field fallbacks, including decimal objects with `toNumber()`. **Validates: 6.3**
  - [x] 9.5 Property 4: `voice` present iff non-negative integer. **Validates: 6.4**
  - [x] 9.6 Property 5: one start and one end per item, cancelled or rejected ends false. **Validates: 3.2, 3.4, 3.5, 3.7, 6.9 to 6.11**
  - [x] 9.7 Property 6: single loop, guard and current item released. **Validates: 6.8, 6.12**
  - [x] 9.8 Property 7: StopSpeaking clears, cancels, never ends twice. **Validates: 7.2, 7.3, 15.4**
  - [x] 9.9 Property 8: plugin-undefined guard. **Validates: 5.1 to 5.3, 6.13, 7.6, 8.5, 9.6, 10.3, 11.3**
  - [x] 9.10 Property 9: `LanguagesJSON` and `Supported` mapping. **Validates: 8.2 to 8.4, 10.2, 10.4**
  - [x] 9.11 Property 10: voices JSON order and mapping. **Validates: 9.3 to 9.5**
  - [x] 9.12 Property 11: resolve timing. **Validates: 6.7, 7.5, 8.6, 11.2**
  - [x] 9.13 Property 12: OpenInstall rejection warned, not signalled. **Validates: 11.4**
  - [x] 9.14 Property 13: empty text rejected. **Validates: 6.14, 15.6**
  - [x] 9.15 Example test: lazy queue init. _Requirements: 6.2_

- [x] 10. Implement the Block On Ready and On Destroy (Studio)
  - On Ready: JS node with Text output `HandlerId` (design.md "On Ready"), then Assign `HandlerId = JavaScript1.HandlerId`.
  - On Destroy: JS node with Text input `HandlerId` set to the Block variable (design.md "On Destroy").
  - Studio check: the three `$actions.TriggerOn*` helpers are offered inside the On Ready node.
  - Satisfies pre-flight checklist item 10 (`odc-mobile-rules.md`: "Does any cleanup in On Destroy assume it runs before the next screen's On Ready?"): On Destroy only removes the listeners stored under *its own* `HandlerId`. It never assumes it runs before, or after, the next screen's On Ready, because it never touches another instance's entry in `window._ttsHandlers`.
  - _Requirements: 12.1 to 12.7_
  - [x] 10.1 Example tests for On Ready and On Destroy
    - On Ready registers three listeners, outputs a `HandlerId`, and each Signal calls the matching `$actions` helper with the mapped payload.
    - With instance B registered before instance A's On Destroy, B still receives Signals and A's listeners are gone.
    - On Destroy cancels the current item, clears the queue, calls `stop()` only when the plugin exists (ignoring rejection), and resolves last.
    - _Requirements: 12.1 to 12.6_

- [x] 11. Checkpoint: all local tests pass (blocks Publish #1)
  - Run `npm test` (9.2 to 9.15 and 10.1). All must pass. (30/30 passing, confirmed 2026-10-14.)
  - Studio-only checks (JSON Deserialize, Assign, `$actions` resolving) are confirmed in Studio.
  - Re-run the pre-flight checklist (`odc-mobile-rules.md`) against the finished build, item by item, including item 10 (On Destroy keyed by its own `HandlerId`, no ordering assumption versus the next screen's On Ready).

- [x] 12. Publish the library (Publish Gate #1, Studio)
  - Publish from ODC Studio when tasks 1 to 10 are in place and task 11 has passed. Wait for it to finish.
  - _Requirements: 1.4, 14.1_

- [x] 13. Verify the publish (read-only MCP)
  - `app_list` (search `CapacitorTextToSpeech`) shows a revision newer than 4. Full confirmation is the dependency resolving in task 14. (Revision 6; Debug and Release builds both `Finished`, no security findings, confirmed via `build_list`.)
  - _Requirements: 14.1_

- [x] 14. Create and wire the TextToSpeechDemo Mobile app (Studio)
  - Create `TextToSpeechDemo` as a **Mobile app** in ODC Studio.
  - In Studio, add the `CapacitorTextToSpeech` dependency: the six Public actions, `TTSVoice`, and `TextToSpeechController`. Place one Block on the test screen.
  - Screen variables `TTSInput` (Text) and `TTSLog` (Text, `""`), with widgets displaying each.
  - Buttons: **Speak** (`QueueMode = 1`, `VoiceIndex = SelectedVoiceIndex`), **Flush** (`QueueMode = 0`, `VoiceIndex = SelectedVoiceIndex`), **Stop** (`StopSpeaking`), **Voices** (`GetSupportedVoices` bound to a list; selecting an item assigns `SelectedVoiceIndex`). `VoiceIndex` must actually be wired to `SelectedVoiceIndex` on the Speak/Flush buttons, not left at default, or voice selection has no effect.
  - Event handlers: `OnSpeakStart` appends `"Speaking started"`; `OnSpeakEnd` appends `"Speaking ended, success=" + Success`; `OnError` appends `"ERROR: " + Message` and shows an Error Feedback Message.
  - Start speech only from button taps, not from the screen's On Ready.
  - Add a second screen with its own `TextToSpeechController` Block instance, a Speak button, its own `TTSLog` display, and the same three event handlers, with navigation to and from the test screen, so on-device scenario 7 (events surviving navigation) has somewhere to navigate to and somewhere to show the result.
  - _Requirements: 13.0 to 13.10_

- [x] 15. Publish TextToSpeechDemo (Publish Gate #2, Studio)
  - Publish from Studio. Wait for it to finish. Confirm with `app_list` / `env_apps`. (Revision 3; Debug and Release builds both `Finished`, no security findings, confirmed via `build_list` 2026-10-14.)
  - _Requirements: 14.2_

- [x] 16. Build the iOS package (Portal, MABS 12.1, Capacitor)
  - Build with MABS 12.1 and the Capacitor runtime. Confirm no errors and that the log shows `CapacitorCommunityTextToSpeech` linked. Install on the iPhone. Done: installed and running on a physical iPhone, with native audio playing through the plugin (task 17) — conclusive functional proof the plugin linked and bundled correctly, even without having separately confirmed the exact `RegisterExecutionPolicyException CapacitorCommunityTextToSpeech.framework` log line.
  - _Requirements: 14.3, 14.4_

- [x] 17. iOS on-device validation [NON-BLOCKING, run by the user]
  - Silent switch off, or `Category = "playback"`.
  - Run the seven scenarios in design.md "iOS on-device validation". All 7 passed on physical iPhone (2026-10-14). Scenario 7 initially looked broken (no events, no audio) on the second screen; cause was a wiring mistake (the Speak button called `StopSpeaking` instead of `Speak`), not a Block/library bug. Fixed in Studio, republished, retested, passes.
  - Record results in the run log. Move confirmed items from "Unverified" to "Confirmed" in `.kiro/steering/odc-mobile-rules.md`.
  - _Requirements: 15.1 to 15.8_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0"] },
    { "id": 1, "tasks": ["1", "6"], "note": "Studio clean-up and local reference files can run in parallel." },
    { "id": 2, "tasks": ["2", "3", "9.1"] },
    { "id": 3, "tasks": ["4", "9.2", "9.3", "9.4", "9.5", "9.6", "9.7", "9.8", "9.9", "9.10", "9.11", "9.12", "9.13", "9.14", "9.15"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "10.1"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3", "8.1", "8.2", "8.3", "10"] },
    { "id": 6, "tasks": ["11"], "note": "Blocking gate before Publish #1." },
    { "id": 7, "tasks": ["12"] },
    { "id": 8, "tasks": ["13", "14"] },
    { "id": 9, "tasks": ["15"] },
    { "id": 10, "tasks": ["16"] },
    { "id": 11, "tasks": ["17"], "blocking": false }
  ]
}
```
