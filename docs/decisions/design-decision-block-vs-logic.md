# Design decision: Logic-tab Public actions with a window-event bridge

**Status:** approved, revised 2026-10-14 after checking the ODC docs and the
plugin's v3.0.0 source.

## History

1. The original design put every action in the Block. A Block action cannot be
   Public or have an Output parameter.
2. The first fix kept `Speak`, `StopSpeaking`, `OpenInstall` in the Block. A parent
   screen cannot call a Block's actions, so the demo could never call `Speak`.
3. JS-node limits found in Studio: primitives-only outputs, `$parameters` for
   inputs and outputs, `$resolve()` with no arguments.
4. The review on 2026-10-14 found three more problems:
   - **Navigation order.** ODC runs the new screen's On Ready before the old
     screen's On Destroy. A single global listener set would be removed by the old
     screen, leaving the new screen with no events.
   - **Cancelled speech resolves.** In v3.0.0 iOS, `stop()` makes the in-flight
     `speak()` resolve. The old design reported a stopped phrase as
     `OnSpeakEnd(True)` and fired two end events on Stop.
   - **Empty text** was not validated, and **Decimal inputs** can reach JS as
     objects, not numbers.

## Decision

- All six actions are Logic-tab Public client actions.
- `Speak`, `StopSpeaking`, `OpenInstall` signal through `window` events
  (`ctts:speakstart`, `ctts:speakend`, `ctts:error`).
- The Public Block `TextToSpeechController` holds three events (Is Mandatory = No),
  three Trigger helpers, one internal `HandlerId` variable, and On Ready / On
  Destroy JS. Each instance registers its own listeners under its `HandlerId` and
  removes only those.
- Only the drain loop dispatches `ctts:speakend`. Flush, Stop, and On Destroy mark
  the current item cancelled before `stop()`, so it ends with `success = false`.
- `Speak` rejects empty or whitespace `Text` with "Text is required." and converts
  numeric inputs with `toNumber()` or `Number()`.
- Query actions return output (JSON Text, JSON Deserialize, Assign for lists) and
  dispatch nothing.
- `TTSVoice` and the Block are Public.

## Trade-offs

- Events reach a screen only while its Block is on it. Every Block on screen gets
  every Signal, so use one per screen.
- The previous screen's On Destroy stops speech, so speech started in a screen's
  On Ready can be cut off. Start speech from user actions.
- Query actions have no error signal.
- If the native layer never settled a `speak()` call, the queue would stall. The
  v3.0.0 source resolves on finish and cancel, so this is not expected.

## To confirm in Studio and on the device

- The Block listeners' `$actions.TriggerOn*` calls work after the Public action has
  resolved, including after navigating between two screens with the Block.
