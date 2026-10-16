# Requirements Document

## Introduction

CapacitorTextToSpeech is an OutSystems Developer Cloud (ODC) **Mobile Library** that wraps the Capacitor community Text-to-Speech plugin (`@capacitor-community/text-to-speech@3.0.0`, pinned exactly). It exposes six **Public client actions on the Logic tab** (`Speak`, `StopSpeaking`, `OpenInstall`, `GetSupportedLanguages`, `GetSupportedVoices`, `IsLanguageSupported`) and a **Public Block** named `TextToSpeechController` that raises the speech lifecycle events (`OnSpeakStart`, `OnSpeakEnd`, `OnError`) to the consuming screen.

ODC platform rules shape this design (see `.kiro/steering/odc-mobile-rules.md`):

- A Capacitor plugin wrapper must be a Mobile Library. A library's or app's kind is fixed at creation. A Mobile Library and a Mobile app are created and built in ODC Studio. The OutSystems MCP/Mentor cannot create or load them.
- A Mobile Library can be consumed only by mobile apps and other mobile libraries, so `TextToSpeechDemo` is an ODC **Mobile app**.
- Public client actions are defined on the Logic tab. A client action inside a Block cannot be Public and cannot have an Output parameter. A parent screen cannot call a Block's client actions or read its variables.
- JavaScript cannot raise a Block event. Only JavaScript inside the Block can call `$actions.<blockAction>()`. The Public actions therefore signal through **window events**, and the Block listens for them and triggers its events.
- When navigating between screens, the target screen's On Ready runs **before** the old screen's On Destroy. Listener cleanup must therefore be per Block instance.
- JavaScript-node inputs are read as `$parameters.<Name>`, outputs are set as `$parameters.<Name>`, and `$resolve()` takes no arguments. JS outputs are primitives only, so Lists and Record Lists are returned as JSON Text and converted with JSON Deserialize. Decimal inputs can arrive as decimal objects, so numeric inputs are coerced with `Number()`.

Capacitor plugins referenced in a mobile library's extensibility configuration are bundled during the mobile package build (MABS 12 or higher) and made available globally through `window.CapacitorPlugins`.

Version 3.0.0 is pinned deliberately: it has no `queueStrategy` option, no `onRangeStart` event, and no native event emitter (no `addListener`). The library therefore implements its own in-memory JavaScript queue with a re-entrancy guard. On iOS, v3.0.0 resolves (does not reject) an in-flight `speak()` call when speech is stopped, so the library marks the in-flight item as cancelled to report it correctly.

## Glossary

- **CapacitorTextToSpeech**: The ODC Mobile Library being built.
- **TextToSpeechController**: The Public Block that listens for the library's window events and triggers `OnSpeakStart`, `OnSpeakEnd`, and `OnError`. It has no Public client actions and no Input Parameters. Its only local variable is the internal `HandlerId`.
- **Public_Actions**: The six Public client actions on the Logic tab.
- **TTS_Plugin**: `@capacitor-community/text-to-speech@3.0.0`, read in JavaScript as `window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null`.
- **TTS_Queue**: The in-memory array `window._ttsQueue` of pending speak items.
- **Current_Item**: `window._ttsCurrent`, the item being spoken right now, or `null`.
- **Drain_Loop**: The background `drainQueue()` coroutine that speaks queued items one at a time.
- **Speaking_Guard**: The flag `window._ttsSpeaking` that ensures only one Drain_Loop runs.
- **Signal**: A `CustomEvent` dispatched on `window`: `ctts:speakstart` (no detail), `ctts:speakend` (detail `{ success: Boolean }`), `ctts:error` (detail `{ message: String }`).
- **Handler_Registry**: `window._ttsHandlers`, an object mapping each Block instance's `HandlerId` to its three listener functions.
- **QueueMode**: Integer input. `0 = Flush`, `1 = Add`.
- **VoiceIndex**: The array index of a voice from `GetSupportedVoices`, passed into `Speak`. `-1` means "let the engine pick".
- **TTSVoice**: Public structure with `VoiceIndex` (Integer), `Name` (Text), `Lang` (Text), `IsDefault` (Boolean), `IsLocalService` (Boolean), `VoiceURI` (Text).
- **TextToSpeechDemo**: The consuming ODC Mobile app with a test screen.
- **OutSystems_MCP**: The connected OutSystems MCP server, used here for read-only checks only (`app_list`, `env_apps`, `env_app`).
- **$parameters / $resolve() / $actions**: The JavaScript-node objects for parameters, completion (no arguments), and client action calls.

## Requirements

### Requirement 1: Mobile Library and Extensibility Configuration

**User Story:** As a developer, I want CapacitorTextToSpeech to be a Mobile Library that pins the exact plugin version, so that the plugin bundles against the v3.0.0 API surface.

#### Acceptance Criteria

1. THE CapacitorTextToSpeech SHALL be an ODC **Mobile Library** created and built in ODC Studio, because extensibility configurations exist only on mobile libraries and a library's kind is fixed at creation.
2. THE CapacitorTextToSpeech SHALL define an Extensibility Configuration whose `buildConfigurations.capacitor.source.npm` value is exactly `@capacitor-community/text-to-speech@3.0.0`.
3. THE version SHALL be `3.0.0` exactly, with no range operators (`^`, `~`, `>=`).
4. WHEN the library is published from ODC Studio, THE plugin SHALL bundle into consuming mobile apps and be reachable at `window.CapacitorPlugins.TextToSpeech`.
5. IF any version other than `3.0.0` is declared, THEN THE library SHALL NOT be considered valid for this build.
6. THE library SHALL be consumable only by mobile apps and other mobile libraries.

### Requirement 2: TextToSpeechController Block

**User Story:** As a consumer-screen developer, I want a Block I can place on my screen to receive speech events.

#### Acceptance Criteria

1. THE library SHALL contain a Block named `TextToSpeechController` with **Public = Yes**, so consuming apps can add it as a dependency.
2. THE Block SHALL have no Input Parameters and no Public client actions.
3. THE Block SHALL have exactly one local variable, `HandlerId` (Text, default `""`), used only internally to remove this instance's listeners on destroy. It is not readable by the parent and SHALL NOT be documented as consumer state.

### Requirement 3: Block Events

**User Story:** As a consumer-screen developer, I want events for speech start, end, and errors.

#### Acceptance Criteria

1. THE Block SHALL define an event `OnSpeakStart` with zero Input Parameters and **Is Mandatory = No**.
2. WHEN the Drain_Loop begins speaking an item, THE library SHALL dispatch `ctts:speakstart`, and THE Block SHALL trigger `OnSpeakStart`.
3. THE Block SHALL define an event `OnSpeakEnd` with one Input Parameter `Success` (Boolean) and **Is Mandatory = No**.
4. WHEN an item finishes speaking to completion, THE library SHALL dispatch `ctts:speakend` with `success = true`, and THE Block SHALL trigger `OnSpeakEnd` with `Success = True`.
5. WHEN an item is stopped or flushed before completion, or fails, THE library SHALL dispatch `ctts:speakend` with `success = false`, and THE Block SHALL trigger `OnSpeakEnd` with `Success = False`.
6. THE Block SHALL define an event `OnError` with one Input Parameter `Message` (Text) and **Is Mandatory = No**.
7. IF a speech operation fails, THEN THE library SHALL dispatch `ctts:error` with the failure description, and THE Block SHALL trigger `OnError` with that `Message`.

### Requirement 4: Block Helper Client Actions

**User Story:** As a developer, I want thin Block client actions that fire the events, so that the Block's JavaScript can raise OutSystems events.

#### Acceptance Criteria

1. THE Block SHALL provide client action `TriggerOnSpeakStart` (no inputs) that triggers `OnSpeakStart`.
2. THE Block SHALL provide client action `TriggerOnSpeakEnd` with Input Parameter `Success` (Boolean) that triggers `OnSpeakEnd` with `Success` mapped.
3. THE Block SHALL provide client action `TriggerOnError` with Input Parameter `Message` (Text) that triggers `OnError` with `Message` mapped.
4. THE helper actions SHALL contain only the Trigger Event, with no other logic.

### Requirement 5: Plugin Availability Check

**User Story:** As a developer, I want every Public action to degrade gracefully when the plugin is absent (Studio preview, unlinked build).

#### Acceptance Criteria

1. EVERY Public action SHALL read the plugin as `window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null` and SHALL NOT throw when either is undefined.
2. IF the plugin is unavailable when `Speak`, `StopSpeaking`, or `OpenInstall` is invoked, THEN THE action SHALL dispatch `ctts:error` exactly once with `"TextToSpeech plugin not found on window.CapacitorPlugins."` and resolve without calling any plugin method.
3. IF the plugin is unavailable when `GetSupportedLanguages`, `GetSupportedVoices`, or `IsLanguageSupported` is invoked, THEN THE action SHALL set its output to the default (`"[]"`, `"[]"`, `false`), dispatch nothing, and resolve without calling any plugin method.

### Requirement 6: Speak Action and In-Memory Queue

**User Story:** As a consumer-screen developer, I want a Speak action with voice and queue control.

#### Acceptance Criteria

1. THE library SHALL provide Public client action `Speak` with inputs `Text` (Text, mandatory), `Lang` (Text, `"en-US"`), `Rate` (Decimal, `1.0`), `Pitch` (Decimal, `1.0`), `Volume` (Decimal, `1.0`), `VoiceIndex` (Integer, `-1`), `Category` (Text, `"ambient"`), `QueueMode` (Integer, `1`).
1a. `Rate`, `Pitch`, and `Volume` are passed through to iOS unvalidated. On iOS, `Rate` is clamped to `0.0`-`1.0` (default `~0.5`, so `1.0` is iOS's maximum speed, not its natural pace); `Pitch` is clamped to `0.5`-`2.0` (default `1.0`); `Volume` is clamped to `0.0`-`1.0` (default `1.0`) and is only a multiplier on the device's current system/media volume — IT SHALL NOT override or exceed the user's physical volume setting. These are platform (`AVSpeechUtterance`) facts, not behavior this action enforces.
2. THE action SHALL initialize `window._ttsQueue` to an empty array when it does not exist.
3. WHEN building a queue item, THE action SHALL set `text` from `Text`; `lang` from `Lang` or `"en-US"` when empty; `rate`, `pitch`, `volume` from `Number()` of the input when that is a finite number greater than 0, otherwise `1.0`; and `category` from `Category` or `"ambient"` when empty.
4. WHERE `Number(VoiceIndex)` is an integer greater than or equal to `0`, THE item SHALL include `voice` set to it. Otherwise `voice` SHALL be absent.
5. WHEN `QueueMode` is `0` (Flush), THE action SHALL clear `window._ttsQueue`, mark Current_Item (if any) as cancelled, call `TTS_Plugin.stop()` ignoring rejection, and then append the new item.
6. WHEN `QueueMode` is not `0` (Add), THE action SHALL append the new item to the end of `window._ttsQueue`.
7. WHEN the item is queued, THE action SHALL start the Drain_Loop and call `$resolve()` immediately.
8. WHILE Speaking_Guard is true, THE action SHALL NOT start a second Drain_Loop.
9. FOR each item, THE Drain_Loop SHALL take it from the front, set it as Current_Item, dispatch `ctts:speakstart`, and await `TTS_Plugin.speak()`.
10. WHEN `speak()` settles, THE Drain_Loop SHALL dispatch exactly one `ctts:speakend`, with `success = true` only if `speak()` resolved and the item was not marked cancelled.
11. IF `speak()` rejects, THEN THE Drain_Loop SHALL dispatch `ctts:error` with the rejection message before that item's `ctts:speakend` (`success = false`).
12. WHEN the queue is empty, THE Drain_Loop SHALL clear Current_Item, set Speaking_Guard to false, and stop, including when an unexpected error occurs.
13. IF the plugin is unavailable, THEN THE action SHALL dispatch `ctts:error` with the plugin-not-found message and resolve without queueing.
14. IF `Text` is empty or only whitespace, THEN THE action SHALL dispatch `ctts:error` with `"Text is required."`, SHALL NOT change the queue or call the plugin, and SHALL resolve.

### Requirement 7: StopSpeaking Action

**User Story:** As a consumer-screen developer, I want to stop speech and clear the queue.

#### Acceptance Criteria

1. THE library SHALL provide Public client action `StopSpeaking` with no inputs.
2. WHEN called, THE action SHALL clear `window._ttsQueue` and mark Current_Item (if any) as cancelled, before calling `TTS_Plugin.stop()`.
3. THE action SHALL NOT dispatch `ctts:speakend` itself. The in-flight item, if any, ends with `ctts:speakend` `success = false` through the Drain_Loop. WHEN nothing is speaking, no `ctts:speakend` is dispatched.
4. IF `TTS_Plugin.stop()` rejects, THEN THE action SHALL dispatch `ctts:error` with the rejection message.
5. THE action SHALL call `$resolve()` without waiting for `stop()` to settle.
6. IF the plugin is unavailable, THEN THE action SHALL dispatch `ctts:error` with the plugin-not-found message and resolve.

### Requirement 8: GetSupportedLanguages Action

**User Story:** As a consumer-screen developer, I want the supported languages.

#### Acceptance Criteria

1. THE library SHALL provide Public client action `GetSupportedLanguages` with Output Parameter `Languages` (Text List).
2. THE JavaScript node SHALL set its Text output `LanguagesJSON` to `JSON.stringify(result.languages || [])`, and the flow SHALL convert it with JSON Deserialize (`Text List`) and Assign it to `Languages`.
3. WHEN the result has no languages, `LanguagesJSON` SHALL be `"[]"`.
4. IF `getSupportedLanguages()` rejects, THEN THE node SHALL log the error with `console.error`, set `LanguagesJSON` to `"[]"`, and dispatch nothing.
5. IF the plugin is unavailable, THEN `LanguagesJSON` SHALL be `"[]"` and nothing is dispatched.
6. THE node SHALL call `$resolve()` only after the promise settles.

### Requirement 9: GetSupportedVoices Action and TTSVoice Structure

**User Story:** As a consumer-screen developer, I want the available voices with their indexes, so a user can pick a `VoiceIndex` for `Speak`.

#### Acceptance Criteria

1. THE library SHALL define structure `TTSVoice` with **Public = Yes** and exactly the attributes `VoiceIndex` (Integer), `Name` (Text), `Lang` (Text), `IsDefault` (Boolean), `IsLocalService` (Boolean), `VoiceURI` (Text).
2. THE library SHALL provide Public client action `GetSupportedVoices` with Output Parameter `Voices` (`TTSVoice` List).
3. THE JavaScript node SHALL map each resolved voice, in order, to `{ VoiceIndex: index, Name, Lang, IsDefault, IsLocalService, VoiceURI }` from `name`, `lang`, `default`, `localService`, `voiceURI`, with missing text as `""` and booleans coerced.
4. THE node SHALL set Text output `VoicesJSON` to the JSON of the mapped array, and the flow SHALL convert it with JSON Deserialize (`TTSVoice List`) and Assign it to `Voices`. A missing or empty array yields `"[]"`.
5. IF `getSupportedVoices()` rejects, THEN THE node SHALL log with `console.error`, set `VoicesJSON` to `"[]"`, and dispatch nothing.
6. IF the plugin is unavailable, THEN `VoicesJSON` SHALL be `"[]"` and nothing is dispatched.
7. ON iOS, v3.0.0 reports every voice with `default = false` and `localService = true`. Consumers SHALL NOT rely on `IsDefault` on iOS.

### Requirement 10: IsLanguageSupported Action

**User Story:** As a consumer-screen developer, I want to check whether a language is supported.

#### Acceptance Criteria

1. THE library SHALL provide Public client action `IsLanguageSupported` with input `Lang` (Text) and output `Supported` (Boolean), implemented as one JavaScript node followed by an Assign.
2. THE node SHALL set `$parameters.Supported` to `!!result.supported`.
3. IF the plugin is unavailable, THEN `Supported` SHALL be `false` without calling the plugin, and nothing is dispatched.
4. IF `isLanguageSupported()` rejects, THEN `Supported` SHALL be `false` and nothing is dispatched.

### Requirement 11: OpenInstall Action

**User Story:** As a consumer-screen developer, I want to open the TTS install flow on Android, as a no-op on iOS.

#### Acceptance Criteria

1. THE library SHALL provide Public client action `OpenInstall` with no inputs.
2. WHEN the plugin is available, THE action SHALL call `openInstall()` without awaiting it and resolve immediately.
3. IF the plugin is unavailable, THEN THE action SHALL dispatch `ctts:error` with the plugin-not-found message, resolve, and not call `openInstall()`.
4. IF `openInstall()` rejects, THEN THE action SHALL log a warning with `console.warn` and SHALL NOT dispatch `ctts:error`.

### Requirement 12: Block On Ready and On Destroy

**User Story:** As a consumer-screen developer, I want events to keep working across navigation, and speech to stop when I leave a screen.

#### Acceptance Criteria

1. WHEN the Block's On Ready runs, THE JavaScript node SHALL create a unique id, register one `window` listener per Signal for this instance, store them in Handler_Registry under that id, set the Text output `HandlerId`, and resolve. The flow SHALL Assign the output to the Block variable `HandlerId`.
2. THE listeners SHALL call `$actions.TriggerOnSpeakStart()`, `$actions.TriggerOnSpeakEnd(Boolean)` (from `detail.success`), and `$actions.TriggerOnError(Text)` (from `detail.message`).
3. WHEN the Block's On Destroy runs, THE JavaScript node SHALL remove only the listeners registered under its own `HandlerId` and delete that entry, leaving other instances' listeners intact.
4. THEN THE node SHALL mark Current_Item (if any) as cancelled, clear `window._ttsQueue`, and, if the plugin is defined, call `stop()` ignoring rejection.
5. THE node SHALL call `$resolve()` last.
6. EVERY Block instance on screen SHALL receive every Signal. Consumers SHOULD place one Block per screen.
7. BECAUSE the old screen's On Destroy runs after the new screen's On Ready, speech started in a screen's On Ready can be stopped by the previous screen's On Destroy. Consumers SHOULD start speech from user actions, not from On Ready.

### Requirement 13: TextToSpeechDemo Test Screen

**User Story:** As a developer, I want a test screen in a Mobile app to exercise the library on a device.

#### Acceptance Criteria

0. THE TextToSpeechDemo SHALL be an ODC **Mobile app** created and built in ODC Studio.
1. THE app SHALL add the CapacitorTextToSpeech dependency (the six Public actions, `TTSVoice`, and the `TextToSpeechController` Block) and place one Block on the test screen.
2. THE screen SHALL define Text variables `TTSInput` and `TTSLog` (default `""`), and SHALL display `TTSLog` on screen (e.g. an Expression or multi-line Text widget bound to it), so the running event log is visible while testing.
3. A button SHALL call `Speak` with `Text = TTSInput`, other inputs at defaults, `QueueMode = 1`.
4. ON `OnSpeakStart`, THE screen SHALL append `"Speaking started"` to `TTSLog`.
5. ON `OnSpeakEnd`, THE screen SHALL append `"Speaking ended, success=" + Success`.
6. ON `OnError`, THE screen SHALL append `"ERROR: " + Message`.
7. ON `OnError`, THE screen SHALL show an Error Feedback Message.
8. A second button SHALL call `GetSupportedVoices` and bind the result to a list from which a `VoiceIndex` can be picked, and the picked value SHALL be passed into the `Speak` and Flush buttons' `VoiceIndex` input so scenario 5 in Requirement 15 is actually exercised, not left at its default.
9. THE screen SHALL provide buttons to call `StopSpeaking` and `Speak` with `QueueMode = 0`, so scenarios 3 and 4 in Requirement 15 can be run.
10. THE app SHALL include a second screen with its own `TextToSpeechController` Block instance, its own way to Speak, and its own `TTSLog`-equivalent display handling that Block's `OnSpeakStart`/`OnSpeakEnd`/`OnError`, reachable by navigating from the test screen and back, so scenario 7 in Requirement 15 (events surviving navigation) has something to navigate to and somewhere to show the result.

### Requirement 14: Publishing and Mobile Package Build

**User Story:** As a developer, I want the library and app published and built into an iOS package.

#### Acceptance Criteria

1. WHEN CapacitorTextToSpeech is published from ODC Studio, THE library SHALL be resolvable by TextToSpeechDemo.
2. WHEN TextToSpeechDemo is published from ODC Studio after the library publish has finished, THE app SHALL be available in the Development environment (confirmable with `app_list` / `env_apps`).
3. WHEN the iOS package is built from the ODC Portal with MABS 12 or higher and the Capacitor runtime, THE build SHALL bundle `@capacitor-community/text-to-speech@3.0.0` and link `CapacitorCommunityTextToSpeech`.
4. THE build SHALL complete without errors, and its log SHALL show the `CapacitorCommunityTextToSpeech` framework being linked.

### Requirement 15: iOS On-Device Validation

**User Story:** As a developer, I want to prove the bridge, queue, events, and error path on a physical iPhone.

#### Acceptance Criteria

1. `Speak` with non-empty `Text` SHALL fire `OnSpeakStart`, play audio, then fire `OnSpeakEnd(True)`.
2. Two quick `Speak` calls with `QueueMode = 1` SHALL play in order without overlap, with one `OnSpeakEnd(True)` per phrase.
3. `Speak` with `QueueMode = 0` during playback SHALL cut off the current phrase (its `OnSpeakEnd(False)`), discard pending phrases, and play the new phrase.
4. `StopSpeaking` during playback SHALL stop audio and fire exactly one `OnSpeakEnd(False)`, with no queued phrases played afterward.
5. A non-default `VoiceIndex` from `GetSupportedVoices` SHALL audibly change the voice.
6. `Speak` with empty `Text` SHALL fire `OnError("Text is required.")`. `Speak` with an unsupported `Lang` SHALL fire `OnError` with the plugin's message, then `OnSpeakEnd(False)`.
7. The Block events SHALL reach the screen although the Public action had already resolved, and SHALL keep working after navigating to another screen with the Block and back.
8. Testing SHALL be done with the iPhone's silent switch off, or with `Category = "playback"`, because the default `ambient` category is muted by the silent switch.
