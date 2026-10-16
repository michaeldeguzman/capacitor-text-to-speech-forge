# Run Log — CapacitorTextToSpeech build

Timestamped record of build activity, one entry per task event (start, finish,
pass/fail, publish terminal state, build-log confirmation). Maintained during
the build — both automatically by the `PostTaskExec` hook
(`.kiro/hooks/run-log-task.json`) and by explicit in-task appends.

Timestamps are ISO 8601 local time with UTC offset (e.g. `2026-10-13T14:32:05-07:00`).

Entry format:

```
## <ISO-8601 timestamp> — Task <id>: <short title>
- event: <started | finished | passed | failed | published | deployed | built | note>
- detail: <one-line description of what happened>
- result: <outcome, e.g. "terminal: succeeded", "11/12 property tests pass", "n/a">
```

---

Editor's note (16 October 2026): entries below refer to assets being created
in the ODC Portal. That was the agent's assumption at the time. The author
created both the Mobile library and the Mobile app in ODC Studio. The iOS
package builds were run in the ODC Portal.

---

## 2026-10-14T05:39:56+11:00 — Task 0: Set up build logging
- event: started
- detail: Confirming logs dir (run-log.md, mentor-transcript.md) and PostTaskExec hook are present and reset for a fresh build.
- result: in progress

## 2026-10-14T05:39:56+11:00 — Task 0: Set up build logging
- event: finished
- detail: Confirmed logs/run-log.md and logs/mentor-transcript.md exist with headers; PostTaskExec hook .kiro/hooks/run-log-task.json present with corrected capacitor-text-to-speech path.
- result: logging active for tasks 1 onward (hook auto-stamp activates next session; in-task appends active now)

## 2026-10-14T05:40:59+11:00 — Task 1: Create CapacitorTextToSpeech mobile library + extensibility config
- event: started
- detail: Started Mentor session <REDACTED-session-id>; created Library asset CapacitorTextToSpeech (applicationKey <REDACTED-asset-key>) in portfolio <REDACTED>. Next: set extensibility configuration pinning @capacitor-community/text-to-speech@3.0.0 (auto-converts Library -> Mobile Library).
- result: in progress

## 2026-10-14T05:47:09+11:00 — Task 1: Create CapacitorTextToSpeech mobile library + extensibility config
- event: failed
- detail: Mentor confirmed (two exchanges, run <REDACTED-run-id> then <REDACTED-run-id>) that it cannot create a Mobile Library — only reactive libraries — and a ReactiveLibrary cannot be converted to a Mobile Library by any means. The created asset CapacitorTextToSpeech (<REDACTED>) is a ReactiveLibrary; extensibility config was stored but will not be processed as a Capacitor plugin. A Mobile Library must be created in the ODC Portal, then loaded into Mentor by key.
- result: BLOCKED — needs a Mobile Library created manually in the ODC Portal before task 1 can complete. Nothing published; the stray ReactiveLibrary is an unpublished session asset.

## 2026-10-14T05:54:02+11:00 — Task 1: Load the Portal-created MobileLibrary into Mentor
- event: failed
- detail: Closed stale session <REDACTED-session-id> (discards the stray ReactiveLibrary <REDACTED>, never published). Started session <REDACTED-session-id> and called mentor_load_asset on the real MobileLibrary CapacitorTextToSpeech (<REDACTED>). Rejected: "Assets of type MobileLibrary are not supported. Supported asset types are: WebApplication, Agent, Library, Workflow." This contradicts Mentor's earlier prose claim that mobile libraries are loadable; the tool surface is authoritative.
- result: BLOCKED — the OutSystems MCP/Mentor cannot create OR load a MobileLibrary. The entire "build the mobile library via Mentor" approach (tasks 1-10, 12) is not achievable through this MCP server. Needs a different build path. Nothing published.

## 2026-10-14T05:57:10+11:00 — Tasks 1-12 (OutSystems side): Studio build sheet
- event: note
- detail: MCP/Mentor cannot create or load a MobileLibrary, so the mobile-library build was captured as a manual ODC Studio build sheet at .kiro/specs/capacitor-text-to-speech/studio-build-sheet.md — covers task 1 (extensibility config), 2 (TTSVoice), 3 (block + state vars), 4 (events), 5 (helpers), 7 (Speak/StopSpeaking/OpenInstall), 8 (query actions), 10 (On Ready/On Destroy), 12 (publish Gate #1). All JS-node bodies, params, defaults, enum values, event names, and error strings transcribed verbatim from design.md. Closed idle Mentor session <REDACTED-session-id>.
- result: build sheet stored for user reference; OutSystems-side build is now a manual-in-Studio activity. Local tasks (6, 9, 11) remain fully doable here and are not blocked.

## 2026-10-14T06:27:50+11:00 — Audit: ODC mobile-development conformance of specs/docs
- event: note
- detail: Reviewed design.md, requirements.md, tasks.md, studio-build-sheet.md against verified ODC mobile constraints (checked vs. OutSystems docs: MABS 12.1 Capacitor extensibility is Studio opt-in). Fixed the Block-scope ambiguity that caused the public-action-vs-event confusion: made explicit in design.md (public + helper actions are Block client actions) and tasks.md (tasks 5, 7, 8 now say "Block Client Action" + Public flag). Build sheet already fixed in prior turn. Reference doc Step 4 already said "on TextToSpeechController" — the bug was transcription, not design.
- result: Encoded durable guardrails into .kiro/steering/outsystems-authoring.md — new "ODC mobile development constraints" section covering mobile-only Portal-created assets, no reactive→mobile conversion, MCP cannot create/load MobileLibrary, and Block scope for events/Trigger Event/client actions. Future specs will follow these automatically.

## 2026-10-14T06:53:00+11:00 — Architecture fix: Block-vs-Logic-tab split; removed unrelated-project references
- event: note
- detail: Applied approved design decision (design-decision-block-vs-logic.md). Fire-and-forget actions (Speak/StopSpeaking/OpenInstall) stay in the Block; output-bearing query actions (GetSupportedLanguages/Voices, IsLanguageSupported) move to the Logic tab as library public actions that do NOT fire block events — approved option (a): on error they resolve empty/default output, no OnError. Updated studio-build-sheet.md (scope banner, Step 7/8 headers, 3 query JS bodies, checklist), design.md (architecture bullets, mermaid diagram, Public Client Actions section, 3 query JS bodies, Property 8, Property 9, Error Handling prose), requirements.md intro, tasks.md task 8, steering/structure.md, steering/product.md, reference/CapacitorTextToSpeech-implementation.md. Removed stray references to an unrelated earlier test app from 5 files; it was never part of this build.
- result: specs/docs now match verified ODC mobile rules (block action can't be Public or have Output; only in-block JS fires block events). Build sheet unblocked for the user's Studio build.

## 2026-10-14T07:33:07+11:00 — ODC alignment pass (A1 architecture)
- event: note
- detail: Applied approved decisions from odc-alignment-review.md. Replaced the Block-vs-Logic split with: all six actions as Logic-tab Public actions; Speak/StopSpeaking/OpenInstall dispatch window events (ctts:speakstart/speakend/error); Block TextToSpeechController has only events, Trigger helpers, and On Ready/On Destroy JS that register/remove listeners calling the helpers via $actions. Dropped IsSpeaking/QueueLength. QueueMode is a plain Integer. Plugin read is now window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null. JS bodies use $parameters.*, $resolve() with no args, and JSON Text -> JSON Deserialize -> Assign for list outputs. Rewrote requirements.md, design.md, tasks.md, studio-build-sheet.md, design-decision-block-vs-logic.md; updated steering (tech, structure, outsystems-authoring); marked the reference doc superseded. Tasks 1, 12, 13, 14, 15 no longer use Mentor; the MCP is read-only.
- result: docs consistent with the confirmed ODC rules. Unproven until Studio/device: listeners calling $actions after the Public action has resolved. Only 8.1 has been confirmed in Studio so far. Local test tasks (6, 9, 11) not yet started.

## 2026-10-14T19:57:47+11:00 — Readiness review (ODC docs + plugin v3.0.0 source)
- event: note
- detail: Verified against the OutSystems docs MCP and the plugin's v3.0.0 iOS source. Fixed: (1) navigation order, where the new screen's On Ready runs before the old screen's On Destroy, so listeners are now per Block instance keyed by a HandlerId variable; (2) a cancelled speak() resolves on iOS, so Stop/Flush/On Destroy now mark the current item cancelled and only the drain loop dispatches ctts:speakend (no more double end or false success); (3) Speak rejects empty Text; (4) Decimal inputs converted via toNumber()/Number(); (5) Block and TTSVoice must be Public, events Is Mandatory = No. Added silent-switch note for on-device tests. Rewrote requirements, design, tasks, build sheet, decision note; updated steering (odc-mobile-rules, structure, tech).
- result: throwaway Node check of the design JS against an iOS-like mock passed 13/13 (stop, flush, idle stop, empty text, unsupported lang, decimal coercion, two-screen navigation). Build-sheet JS identical to design. Tasks 0/43 checked, tasks.meta.json empty. Tenant: library at revision 4 (task 1 clears it), TextToSpeechDemo not created yet.

## 2026-10-14T20:00:12+11:00 — Task 0: Set up build logging
- event: finished
- detail: Confirmed run-log.md, mentor-transcript.md, and PostTaskExec hook (path points at capacitor-text-to-speech/logs). Starting the build from scratch.
- result: logging active

## 2026-10-14T20:03:56+11:00 — Task 6: JS-node reference files
- event: finished
- detail: Extracted 8 bodies verbatim from design.md into reference/js-nodes/ (Speak, StopSpeaking, OpenInstall, GetSupportedLanguages, GetSupportedVoices, IsLanguageSupported, OnReady, OnDestroy).
- result: tests/reference-sync.test.js confirms each file equals design.md and appears in the build sheet

## 2026-10-14T20:03:56+11:00 — Task 9 and 10.1: test suite
- event: passed
- detail: tests/harness.js (iOS-like plugin mock where a cancelled speak resolves), tests/properties.test.js (Properties 1-13, 100 runs each, plus lazy init), tests/lifecycle.test.js (On Ready/On Destroy incl. two-screen navigation order), tests/reference-sync.test.js.
- result: npm test 30/30 passed. First run had 1 failure from a test bug (Property 6 asserted globals when no Speak ran); fixed the test, not the node code.

## 2026-10-14T20:03:56+11:00 — Task 11: local test gate
- event: note
- detail: Local part passed (30/30). Remaining before Publish #1: Studio checks (JSON Deserialize into TTSVoice List, Assigns, $actions offered in On Ready) once the user builds tasks 1-5, 7, 8, 10.
- result: local gate green; task left open until Studio checks are done

## 2026-10-15T01:48:51+11:00 — Tasks 1-5, 7, 8, 10-15: Studio build complete, both publishes done
- event: published
- detail: User completed the full studio-build-sheet.md run sheet, including the Step 14 addition (TextToSpeechDemo wiring + TTSLog/TTSInput display widgets). Confirmed via app_list/build_list: CapacitorTextToSpeech at revision 6 (Debug+Release Finished, no security findings), TextToSpeechDemo at revision 3 (Debug+Release Finished, no security findings). Marked tasks 1-5, 7, 8, 10-15 complete in tasks.md.
- result: Publish Gate #1 and #2 both done. Local gate (task 11) was already green at 30/30. Remaining: task 16 (MABS 12.1 iOS mobile package build) and task 17 (on-device validation, non-blocking).

## 2026-10-15T02:35:18+11:00 — Task 14 reopened: on-device scenarios 5 and 7 not buildable as specified
- event: failed
- detail: User flagged while running task 17 that scenario 5 (Voice selection) and 7 (Event bridge across navigation) could not be exercised as the build sheet described. Two real gaps found: (1) Step 14 item 5 said Speak uses "other inputs default" while the Voices bullet claimed VoiceIndex was "passed into the Speak/Flush buttons VoiceIndex input" -- contradictory, and if default wins, VoiceIndex is never wired to the picked voice, so scenario 5 has no effect; (2) no second screen was ever specified anywhere, so scenario 7 ("navigate to another screen with the Block and back") has nothing to navigate to, despite requirements.md 15.7 and design.md both demanding it.
- result: Fixed studio-build-sheet.md Step 14 (SelectedVoiceIndex variable, explicit VoiceIndex wiring on Speak/Flush, new item 8 adding a second screen + nav), requirements.md (13.8 updated, new 13.10), tasks.md task 14. Reopened task 14 (unchecked) since the Studio build does not yet satisfy it. User needs to add SelectedVoiceIndex + VoiceIndex wiring and the second screen, republish, then resume task 17.

## 2026-10-15T03:24:08+11:00 — Task 17: all 7 on-device scenarios pass
- event: passed
- detail: User ran all 7 scenarios from design.md "iOS on-device validation" on a physical iPhone. Scenarios 1-6 passed first try. Scenario 7 (event bridge across navigation) initially showed no audio and no events on the second screen; root cause was a Studio wiring mistake -- the second screen's Speak button called StopSpeaking instead of Speak, not a bug in the library/Block/event-bridge logic. User fixed the button binding, republished, retested: passes.
- result: All 7 on-device scenarios confirmed. Task 14 re-closed (the fix was a consumer-screen wiring error, not a spec/build-sheet gap once the earlier log/VoiceIndex/second-screen gaps were already fixed). Task 17 closed. Moved the event-bridge-after-navigation item from Unverified to Confirmed in odc-mobile-rules.md. Remaining unverified: Decimal-as-object JS input coercion (not yet exercised with a real Decimal value on device).

## 2026-10-15T03:25:08+11:00 — Correction: task 16 was left unchecked
- event: finished
- detail: User caught that task 16 (build the iOS package) was still unchecked despite task 17 (on-device validation on that same package) being marked complete -- an inconsistency, since 17 cannot happen without 16. Checked task 16, noting that working native audio on-device is conclusive functional proof the plugin linked, though the exact build-log line (RegisterExecutionPolicyException CapacitorCommunityTextToSpeech.framework) was not separately confirmed through a tool.
- result: all 18 tasks (0-17) now checked off in tasks.md.

## 2026-10-15T03:26:50+11:00 — Re-verification: MCP connectivity vs. mobile-asset load limit
- event: note
- detail: User questioned whether the MCP connection itself was broken, given the repeated "can't inspect mobile modules" finding. Re-ran live checks rather than relying on earlier results in the session. app_list confirmed the connection is live and current: TextToSpeechDemo now at revision 11, CapacitorTextToSpeech at revision 8 (both bumped from the user's subsequent Studio fixes). Started a fresh Mentor session and called mentor_load_asset on both asset keys directly.
- result: Connection confirmed working (app_list succeeded). mentor_load_asset rejected both assets with the identical error: "Assets of type MobileApplication/MobileLibrary are not supported. Supported asset types are: WebApplication, Agent, Library, Workflow." Confirms this is a deliberate, consistent scope limit on this MCP server's Mentor tool for mobile asset types, not a connectivity issue or a prior mistake. No other available tool reaches into either module's Blocks, actions, screens, or bindings -- app_list/build_list/env_apps/env_app remain read-only metadata only.

## 2026-10-15T03:36:26+11:00 — Documented Rate/Pitch/Volume ranges; explained Volume-follows-system-volume
- event: note
- detail: User tested Rate=5, Pitch=3, Volume=5 on device. Rate and Pitch audibly changed (iOS clamps them, so the extreme values still produced an effect at the clamped bound). Volume did not increase beyond the phones system volume. Researched Apple AVSpeechUtterance docs/forums: Rate is clamped 0.0-1.0 (default ~0.5, so our 1.0 default is actually iOS maximum speed, not its natural pace); Pitch is clamped 0.5-2.0 (default 1.0, matches ours); Volume is clamped 0.0-1.0 (default 1.0, matches ours) but is only a multiplier on the devices current system/media volume -- an app cannot override or exceed the physical volume setting via this API. This is documented iOS behavior (corroborated by multiple developer reports of the same relative-volume ceiling), not a bug in the plugin, the queue, or our JS.
- result: Added the range/clamping/volume-caveat table to design.md (Speak section), a new acceptance criterion 6.1a to requirements.md, and a note to studio-build-sheet.md Step 7.1 input table. No behavior changed -- Speak still passes Rate/Pitch/Volume through unvalidated, matching how AVSpeechUtterance itself works (iOS does the clamping, not us).

## 2026-10-15T04:10:38+11:00 — Last unverified item confirmed: Decimal coercion + fr-FR on device
- event: passed
- detail: User tested Rate=0.3, Pitch=0.7 (fractional Decimal values, within the real AVSpeechUtterance ranges documented earlier) and Lang="fr-FR" on a physical iPhone. Rate audibly slower, Pitch audibly lower, French voice spoke correctly.
- result: This was the one remaining unverified item (Decimal-as-object JS coercion via toNumber()/Number()) now confirmed on device. Updated odc-mobile-rules.md Confirmed/Unverified section: no remaining unverified items for this build.
