# ODC mobile alignment review

Review of `design.md`, `requirements.md`, `tasks.md`, `studio-build-sheet.md`,
`design-decision-block-vs-logic.md`, the reference doc and the steering files
against how mobile apps are built in ODC.

Status: RESOLVED. All decisions were approved (A1 Logic-tab Public actions with
a window-event bridge; `QueueLength` and `IsSpeaking` dropped; plain Integer
`QueueMode`; guarded plugin read) and applied to `design.md`, `requirements.md`,
`tasks.md`, `studio-build-sheet.md`, `design-decision-block-vs-logic.md`, the
steering files, and the reference doc (now marked superseded). The findings below
are kept as the record of why.

## Confirmed ODC rules (from this tenant, from you, and from OutSystems forums)

1. Mobile Library and Mobile app are created in the ODC Portal. The MCP/Mentor
   cannot create them, and `mentor_load_asset` rejects `MobileLibrary`.
2. A block action cannot be Public and cannot have an Output parameter.
3. A parent screen cannot call a block's client actions. A block is driven only
   by Input Parameters (plus `OnParametersChanged`) and reports back through
   Events. Block local variables are not readable by the parent.
4. JS nodes read inputs as `$parameters.<Name>` and set outputs as
   `$parameters.<Name> = value`. `$resolve()` takes no arguments.
5. JS node parameters are primitives only. Lists and Record Lists go through a
   Text JSON output, then JSON Deserialize, then Assign (confirmed in 8.1).
6. Only JS inside the block can call `$actions.<blockAction>()`.

## A. Architecture: the Block-vs-Logic split does not work (needs decision)

`design-decision-block-vs-logic.md` puts `Speak`, `StopSpeaking` and
`OpenInstall` in the block and says the consumer "calls them through the dropped
block instance". By rule 3 that is impossible. I proposed that design and called
it "Coloris-style" without verifying it. That was wrong.

Result today: the demo screen has no way to call `Speak`, `StopSpeaking` or
`OpenInstall`.

Options:

- **A1 (recommended): all six actions are Logic-tab Public actions. Events go
  through window events.**
  - `Speak`, `StopSpeaking`, `OpenInstall` and the three query actions all live
    on the Logic tab, Public = Yes.
  - Where they now fire `$actions.TriggerOnSpeakStart()`, they dispatch a window
    event instead, for example
    `window.dispatchEvent(new CustomEvent("ctts:speakstart"))`, with
    `ctts:speakend` (detail `{ success }`) and `ctts:error` (detail `{ message }`).
  - The Block's On Ready JS registers listeners that call
    `$actions.TriggerOnSpeakStart/End/Error`. On Destroy removes them.
  - The consumer drops the Block on the screen to receive the three events and
    calls the Public actions directly.
  - Cost: the Block must be on the screen for events to reach it. On Ready is no
    longer empty (it registers listeners). Listener callbacks calling `$actions`
    after the node resolved matches the forum timer pattern, but I have not seen
    it run in Studio, so it needs a quick check before we commit to it.
- **A2: block-only, driven by input parameters.** The consumer sets block inputs
  and the block reacts in `OnParametersChanged`. Awkward for a queue API (repeat
  calls with the same text do not retrigger). Not recommended.
- **A3: drop events.** Public actions only. Loses `OnSpeakStart`, `OnSpeakEnd` and
  `OnError`, which are the point of the library.

## B. Block state variables are not exposed (needs decision)

- `IsSpeaking` and `QueueLength` are block local variables. Per rule 3 the parent
  cannot read them, so "exposed so a consumer can show 3 queued" cannot happen.
- Nothing ever assigns `QueueLength`. No JS or helper updates it.
- Under A1, `IsSpeaking` only matters if the block uses it internally.

Recommendation: drop `QueueLength` (requirements 2.x, Step 3, design, reference).
Keep `IsSpeaking` as a block-internal flag only if something reads it; otherwise
drop it too and remove the Assign from the helpers. Needs your call.

## C. QueueMode "Integer enum" (needs decision)

In ODC an enum is a Static Entity, and a Static Entity input is not an Integer.
The sheet says Integer with `0 = Flush`, `1 = Add`. Recommendation: plain Integer
input, documented values, no enum wording. Say if you want a `TTSQueueMode`
static entity instead (then the action converts it to an Integer for the JS node).

## D. Plugin access guard (needs decision)

`tech.md` says access the plugin directly with no fallback. 8.1 now uses
`window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null` because
the direct form throws when `window.CapacitorPlugins` is undefined. Recommendation:
update the `tech.md` rule to allow this guarded form and use it in every JS node.

## E. Certain errors, mechanical fixes

1. **Mentor cannot load or publish the mobile library or app.** These still say
   otherwise: `design.md` line 7, `requirements.md` intro, `tasks.md` overview
   (line 9), task 1 ("Load it into Mentor by key"), task 12 ("Through the
   OutSystems MCP Mentor session, publish"), task 14 ("load it into Mentor"),
   task 15 ("Through the OutSystems MCP Mentor session, publish"). They
   contradict `mentor_load_asset` rejecting `MobileLibrary`. Fix: build and
   publish both assets in Studio. Use the MCP only for read-only checks
   (`app_list`, `env_apps`, `env_app`) and, if supported for these asset types,
   deploy and status polling. I have not verified the deploy tools against a
   mobile asset.
2. **JS conventions still wrong in `design.md` and the reference doc.**
   - Bare inputs (`Text`, `Lang`, `QueueMode`, `VoiceIndex`) instead of
     `$parameters.*`: Speak, IsLanguageSupported, the queue item data model,
     Property 3 and Property 4 text.
   - `$resolve({ ... })` in the three query actions.
   - The build sheet's 8.2, 8.3 and 7.1 were redrafted last turn but are not yet
     verified in Studio. Only 8.1 is confirmed.
3. **List outputs through JSON.** Still described as direct list outputs: design
   `GetSupportedLanguages` and `GetSupportedVoices`, Properties 9 and 10,
   requirements 8.x and 9.x, tasks 8.1, 8.2, 9.10 and 9.11. The JS now only
   produces a JSON string, so the tests assert the string. JSON Deserialize and
   Assign are ODC flow and are verified in Studio and on device.
4. **Reference doc is out of date.** It still has the all-in-block layout, old
   JS bodies and `TriggerOnError` in query actions. Either mark it superseded or
   bring it in line after A is decided.
5. **Structure name.** Spec uses `TTSVoice`. The snippets you pasted used
   `VoiceInfo`. Keep `TTSVoice` unless you renamed it in Studio.

## F. Items that are fine

- Extensibility JSON and the exact pin `3.0.0`, Portal creation of both assets,
  Mobile app as the only consumer, MABS 12.1 and Capacitor, iOS-only testing.
- The `window._ttsQueue` / `_ttsSpeaking` custom queue and the drain loop design.
- `OnSpeakStart`, `OnSpeakEnd(Success)`, `OnError(Message)` as Block events with
  Trigger Event in a block client action.
- Structures as paste-ready JSON (steering rule).
- Publish ordering: library first, then the demo app.

## Order of work once decisions are made

1. Update `design-decision-block-vs-logic.md` (or replace it) with the chosen
   architecture.
2. Update `design.md`, `requirements.md`, `tasks.md`, the build sheet, the
   reference doc and the steering files in one pass.
3. Re-derive the test plan (task 9) from the corrected contract.
