# CapacitorTextToSpeech: ODC Studio Build Sheet

Step-by-step Studio build of the **CapacitorTextToSpeech Mobile Library** (Steps
1-10, 12) and the **TextToSpeechDemo Mobile app** that consumes it (Step 14). The
OutSystems MCP/Mentor cannot create, load, or publish either asset, so this is
done by hand. All JavaScript matches `design.md` and the files in
`reference/js-nodes/` (task 6). Paste from those files once they exist.

## Asset facts

- **Asset:** `CapacitorTextToSpeech` (ODC **Mobile Library**)
- **Asset key:** `<REDACTED — your tenant's CapacitorTextToSpeech asset key>`
- **Portfolio key:** `<REDACTED — your tenant's portfolio key>`

Steps map to spec tasks by number (Step 1 is task 1, and so on). Step 6 is local.

---

## Where each element lives

| Element | Location | Public |
|---|---|---|
| Extensibility Configuration | Library | n/a |
| `TTSVoice` structure | Data tab | **Yes** |
| `TextToSpeechController` Block | Interface tab | **Yes** |
| `HandlerId` variable | Inside the Block | n/a |
| `OnSpeakStart`, `OnSpeakEnd`, `OnError` events | Inside the Block | Is Mandatory = No |
| `TriggerOnSpeakStart/End/Error` | Client actions inside the Block | n/a (Block actions can't be Public) |
| Block On Ready, On Destroy | Inside the Block | n/a |
| `Speak`, `StopSpeaking`, `OpenInstall` | Logic tab client actions | **Yes** |
| `GetSupportedLanguages`, `GetSupportedVoices`, `IsLanguageSupported` | Logic tab client actions | **Yes** |

Why: a Block's actions can't be Public, can't have outputs, and can't be called by
the parent screen. Only JS inside the Block can call its actions. So the Public
actions send **window events**, and the Block's On Ready listens and triggers its
events.

---

## How JavaScript nodes work (every JS node below)

- Each JS node has its own parameters. Right-click **Parameters** under the code
  editor to add them.
- **Inputs:** add an Input Parameter with the same name as the action input and
  set its value to that input (node input `Text` = `Text`). Read it as
  `$parameters.Text`.
- **Outputs:** add an Output Parameter. Set it as `$parameters.Name = value`.
  Then an **Assign** after the node copies it to the action output
  (`Supported = JavaScript1.Supported`).
- JS node parameters are **primitives only**. Lists come back as JSON **Text**,
  then **JSON Deserialize**, then **Assign**.
- `$resolve()` takes **no arguments**.

---

## Step 1: Clear the library and set the Extensibility Configuration

1. Open `CapacitorTextToSpeech` in Studio. Delete anything left from earlier
   attempts (Blocks, client actions, structures, variables).
2. Open **Extensibility Configurations** and paste exactly:

```json
{
  "buildConfigurations": {
    "capacitor": {
      "source": {
        "npm": "@capacitor-community/text-to-speech@3.0.0"
      }
    }
  }
}
```

Version `3.0.0`, no `^`, `~`, or `>=`. No permissions are needed.

---

## Step 2: Structure `TTSVoice`

Right-click **Structures**, choose **Add Structure from JSON**, paste:

```json
{
  "VoiceIndex": 0,
  "Name": "Samantha",
  "Lang": "en-US",
  "IsDefault": true,
  "IsLocalService": true,
  "VoiceURI": "com.apple.voice.compact.en-US.Samantha"
}
```

Rename it to `TTSVoice` if needed and set **Public = Yes** (it is the output of a
Public action).

| Attribute        | Type    | Note                              |
|------------------|---------|-----------------------------------|
| `VoiceIndex`     | Integer | adjust if ODC infers Long Integer |
| `Name`           | Text    |                                   |
| `Lang`           | Text    |                                   |
| `IsDefault`      | Boolean |                                   |
| `IsLocalService` | Boolean |                                   |
| `VoiceURI`       | Text    |                                   |

---

## Step 3: Block `TextToSpeechController`

1. Add a Block named **`TextToSpeechController`**. Set **Public = Yes**.
2. No Input Parameters, no widgets needed.
3. Add one local variable: **`HandlerId`** (Text, default `""`). It is internal.

---

## Step 4: Block events

| Event          | Input Parameters    | Is Mandatory |
|----------------|---------------------|--------------|
| `OnSpeakStart` | (none)              | No           |
| `OnSpeakEnd`   | `Success` (Boolean) | No           |
| `OnError`      | `Message` (Text)    | No           |

---

## Step 5: Block helper client actions

Client actions **of the Block**. No JavaScript, one node each.

- **5.1 `TriggerOnSpeakStart`** (no inputs): Trigger Event `OnSpeakStart`.
- **5.2 `TriggerOnSpeakEnd`** (input `Success`, Boolean): Trigger Event `OnSpeakEnd`, `Success` = `Success`.
- **5.3 `TriggerOnError`** (input `Message`, Text): Trigger Event `OnError`, `Message` = `Message`.

---

## Step 7: Fire-and-forget Public actions (Logic tab, Public = Yes)

No Output parameters. One JavaScript node each.

### 7.1 `Speak`

| Input        | Type    | Mandatory | Default     |
|--------------|---------|-----------|-------------|
| `Text`       | Text    | Yes       |             |
| `Lang`       | Text    | No        | `"en-US"`   |
| `Rate`       | Decimal | No        | `1.0`       |
| `Pitch`      | Decimal | No        | `1.0`       |
| `Volume`     | Decimal | No        | `1.0`       |
| `VoiceIndex` | Integer | No        | `-1`        |
| `Category`   | Text    | No        | `"ambient"` |
| `QueueMode`  | Integer | No        | `1`         |

`QueueMode`: `0` = Flush, `1` = Add. `Category`: `"ambient"` is muted by the iPhone
silent switch; `"playback"` is not.

`Rate`, `Pitch`, `Volume` are passed through to iOS unvalidated; iOS clamps them:
`Rate` to `0.0`-`1.0` (its own default is `~0.5`, so `1.0` here plays at iOS's
*maximum* speed, not a natural pace), `Pitch` to `0.5`-`2.0`, `Volume` to `0.0`-`1.0`.
**`Volume` only scales relative to the device's current system/media volume — it
cannot exceed or override the user's physical volume setting.** If the phone's
volume is turned down, speech will be quiet no matter what `Volume` is set to;
there is no way around that on iOS.

**JS node inputs:** the same eight names, each set to the action input. No outputs.

```javascript
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

// OutSystems may pass Decimal values as objects, not numbers.
const toNum = (v) => (v != null && typeof v.toNumber === "function") ? v.toNumber() : Number(v);
const positiveOr = (v, fallback) => {
  const n = toNum(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

if (!CapTTS) {
  emit("ctts:error", { message: "TextToSpeech plugin not found on window.CapacitorPlugins." });
  $resolve();
  return;
}

const text = $parameters.Text == null ? "" : String($parameters.Text);
if (text.trim() === "") {
  emit("ctts:error", { message: "Text is required." });
  $resolve();
  return;
}

// v3.0.0 has no native queueStrategy, so implement the queue ourselves.
window._ttsQueue = window._ttsQueue || [];

const item = {
  text: text,
  lang: $parameters.Lang || "en-US",
  rate: positiveOr($parameters.Rate, 1.0),
  pitch: positiveOr($parameters.Pitch, 1.0),
  volume: positiveOr($parameters.Volume, 1.0),
  category: $parameters.Category || "ambient"
};
const voiceIndex = toNum($parameters.VoiceIndex);
if (Number.isInteger(voiceIndex) && voiceIndex >= 0) {
  item.voice = voiceIndex;
}

if (toNum($parameters.QueueMode) === 0) {
  // Flush: drop pending items and cut off the current one. A cancelled
  // speak() resolves on iOS, so mark it to report success = false.
  window._ttsQueue = [];
  if (window._ttsCurrent) {
    window._ttsCurrent.cancelled = true;
  }
  CapTTS.stop().catch(() => {});
}
window._ttsQueue.push(item);

async function drainQueue() {
  if (window._ttsSpeaking) return; // a loop is already running
  window._ttsSpeaking = true;
  try {
    while (window._ttsQueue.length > 0) {
      const next = window._ttsQueue.shift();
      window._ttsCurrent = next;
      emit("ctts:speakstart");
      let ok = true;
      try {
        await CapTTS.speak(next);
      } catch (err) {
        ok = false;
        emit("ctts:error", { message: String(err && err.message ? err.message : err) });
      }
      window._ttsCurrent = null;
      emit("ctts:speakend", { success: ok && !next.cancelled });
    }
  } finally {
    window._ttsCurrent = null;
    window._ttsSpeaking = false;
  }
}

drainQueue();
$resolve();
```

### 7.2 `StopSpeaking`

No inputs, no outputs, no JS parameters.

```javascript
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

if (!CapTTS) {
  emit("ctts:error", { message: "TextToSpeech plugin not found on window.CapacitorPlugins." });
  $resolve();
  return;
}

// Clear pending items and mark the current one cancelled. The drain loop
// dispatches its ctts:speakend (success = false) when speak() resolves.
window._ttsQueue = [];
if (window._ttsCurrent) {
  window._ttsCurrent.cancelled = true;
}
CapTTS.stop().catch((err) => {
  emit("ctts:error", { message: String(err && err.message ? err.message : err) });
});

$resolve();
```

### 7.3 `OpenInstall`

No inputs, no outputs, no JS parameters. Android-only; resolves on iOS.

```javascript
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

if (!CapTTS) {
  emit("ctts:error", { message: "TextToSpeech plugin not found on window.CapacitorPlugins." });
  $resolve();
  return;
}

CapTTS.openInstall().catch((err) => {
  // Documented Android-only call, so a rejection is not surfaced as an error.
  console.warn("openInstall: " + String(err && err.message ? err.message : err));
});

$resolve();
```

---

## Step 8: Query Public actions (Logic tab, Public = Yes)

They return values and send no window events. On failure they return the empty or
default value.

### 8.1 `GetSupportedLanguages` (confirmed in Studio)

Output `Languages` (Text List). **Flow:** JavaScript, JSON Deserialize, Assign.

1. JS node with Text output `LanguagesJSON`:

   ```javascript
   const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

   if (!CapTTS) {
     $parameters.LanguagesJSON = "[]";
     $resolve();
     return;
   }

   CapTTS.getSupportedLanguages()
     .then((result) => {
       const langs = result.languages || [];
       $parameters.LanguagesJSON = JSON.stringify(langs);
       $resolve();
     })
     .catch((err) => {
       console.error("Capacitor TTS getSupportedLanguages error:", err);
       $parameters.LanguagesJSON = "[]";
       $resolve();
     });
   ```

2. JSON Deserialize: JSON String `JavaScript1.LanguagesJSON`, Data Type `Text List`.
3. Assign: `Languages = JSONDeserialize1.Data`.

### 8.2 `GetSupportedVoices`

Output `Voices` (`TTSVoice` List). **Flow:** JavaScript, JSON Deserialize, Assign.

1. JS node with Text output `VoicesJSON`:

   ```javascript
   const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

   if (!CapTTS) {
     $parameters.VoicesJSON = "[]";
     $resolve();
     return;
   }

   CapTTS.getSupportedVoices()
     .then((result) => {
       const voices = (result.voices || []).map((v, idx) => ({
         VoiceIndex: idx,
         Name: v.name || "",
         Lang: v.lang || "",
         IsDefault: !!v.default,
         IsLocalService: !!v.localService,
         VoiceURI: v.voiceURI || ""
       }));
       $parameters.VoicesJSON = JSON.stringify(voices);
       $resolve();
     })
     .catch((err) => {
       console.error("Capacitor TTS getSupportedVoices error:", err);
       $parameters.VoicesJSON = "[]";
       $resolve();
     });
   ```

2. JSON Deserialize: JSON String `JavaScript1.VoicesJSON`, Data Type `TTSVoice List`.
3. Assign: `Voices = JSONDeserialize1.Data`.

On iOS every voice reports `IsDefault = false` and `IsLocalService = true`.

### 8.3 `IsLanguageSupported`

Input `Lang` (Text), output `Supported` (Boolean). **Flow:** JavaScript, Assign.

1. JS node with Text input `Lang` (= `Lang`) and Boolean output `Supported`:

   ```javascript
   const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

   if (!CapTTS) {
     $parameters.Supported = false;
     $resolve();
     return;
   }

   CapTTS.isLanguageSupported({ lang: $parameters.Lang })
     .then((result) => {
       $parameters.Supported = !!result.supported;
       $resolve();
     })
     .catch((err) => {
       $parameters.Supported = false;
       $resolve();
     });
   ```

2. Assign: `Supported = JavaScript1.Supported`.

---

## Step 10: Block On Ready and On Destroy

When you navigate, the next screen's On Ready runs **before** this screen's On
Destroy. So each Block instance keeps its own listeners under its own
`HandlerId` and removes only those.

### On Ready
1. JS node with Text output `HandlerId`:

   ```javascript
   const id = "ctts-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

   const handlers = {
     start: () => {
       $actions.TriggerOnSpeakStart();
     },
     end: (e) => {
       $actions.TriggerOnSpeakEnd(!!(e.detail && e.detail.success));
     },
     error: (e) => {
       $actions.TriggerOnError(String(e.detail && e.detail.message ? e.detail.message : ""));
     }
   };

   window._ttsHandlers = window._ttsHandlers || {};
   window._ttsHandlers[id] = handlers;
   window.addEventListener("ctts:speakstart", handlers.start);
   window.addEventListener("ctts:speakend", handlers.end);
   window.addEventListener("ctts:error", handlers.error);

   $parameters.HandlerId = id;
   $resolve();
   ```

2. Assign: `HandlerId = JavaScript1.HandlerId`.

Studio check: the three `$actions.TriggerOn...` helpers appear in the element tree
under the code editor. If they don't, the helpers are not client actions of this
Block.

### On Destroy
JS node with Text input `HandlerId` (= the Block variable `HandlerId`):

```javascript
const CapTTS = window.CapacitorPlugins ? window.CapacitorPlugins.TextToSpeech : null;

// Remove only this Block instance's listeners. The next screen's Block has
// already registered its own by the time this runs.
const registry = window._ttsHandlers || {};
const handlers = registry[$parameters.HandlerId];
if (handlers) {
  window.removeEventListener("ctts:speakstart", handlers.start);
  window.removeEventListener("ctts:speakend", handlers.end);
  window.removeEventListener("ctts:error", handlers.error);
  delete registry[$parameters.HandlerId];
}

// Stop speech started on this screen.
if (window._ttsCurrent) {
  window._ttsCurrent.cancelled = true;
}
window._ttsQueue = [];
if (CapTTS) {
  CapTTS.stop().catch(() => {});
}

$resolve();
```

---

## Step 12: Publish (Gate #1)

After Steps 1 to 10 and the local test gate (spec task 11):

1. Publish from Studio and wait for it to finish.
2. Don't publish again while a publish is running.
3. Confirm by adding the dependency in `TextToSpeechDemo` (task 14).

---

## Step 14: Create and wire TextToSpeechDemo (Studio)

**Depends on Step 12 having finished.** `TextToSpeechDemo` is a separate asset
from the mobile library.

1. In **ODC Studio**, create `TextToSpeechDemo` as a **Mobile app** (not a
   reactive web app). A Mobile app cannot be created through Mentor; its kind is
   fixed at creation, same as the library.
2. In **Studio**, open `TextToSpeechDemo` and add the `CapacitorTextToSpeech`
   dependency: the six Public actions (`Speak`, `StopSpeaking`, `OpenInstall`,
   `GetSupportedLanguages`, `GetSupportedVoices`, `IsLanguageSupported`), the
   `TTSVoice` structure, and the `TextToSpeechController` Block.
3. Drag the Block onto the test screen. **One Block per screen** — the Block has
   no Public actions and no Input Parameters, so dropping it is only how the
   screen receives its three events.
4. Add Text screen variables `TTSInput` and `TTSLog` (default `""`). Add an
   **Input** widget bound to `TTSInput` so the user can type the phrase to
   speak, and an **Expression** (or multi-line Text display) widget bound to
   `TTSLog` so the running event log is visible on screen. `TTSLog` is a plain
   Text variable; nothing renders it automatically.
5. Add a Integer screen variable `SelectedVoiceIndex` (default `-1`). Add four
   buttons, each calling a Public action directly (not through the Block, since
   the Block has no callable actions):
   - **Speak**: `Speak(Text = TTSInput, QueueMode = 1, VoiceIndex = SelectedVoiceIndex)`,
     other inputs default. `VoiceIndex` must be wired to `SelectedVoiceIndex`,
     not left at the action's own default, or picking a voice in the list below
     will have no effect.
   - **Flush**: `Speak(Text = TTSInput, QueueMode = 0, VoiceIndex = SelectedVoiceIndex)`.
   - **Stop**: `StopSpeaking()`.
   - **Voices**: `GetSupportedVoices()`, bound to a list widget showing `Name` and
     `Lang` per `TTSVoice` item. On selecting an item, assign
     `SelectedVoiceIndex = <selected item>.VoiceIndex` so the next Speak/Flush
     tap uses it.
6. On the Block's events (handled on the screen, since the Block is on it):
   - `OnSpeakStart` → append `"Speaking started"` to `TTSLog`.
   - `OnSpeakEnd` → append `"Speaking ended, success=" + Success` to `TTSLog`.
   - `OnError` → append `"ERROR: " + Message` to `TTSLog` and show an Error
     Feedback Message.
7. Do **not** call `Speak` from the screen's On Ready. The previous screen's On
   Destroy stops speech, so anything started in On Ready can be cut off by
   navigation. Start speech only from the four buttons.
8. Add a **second screen** (e.g. `TTSScreen2`) with its own instance of the
   `TextToSpeechController` Block, its own **Speak** button
   (`Speak(Text = "Second screen", QueueMode = 1)` is enough; it does not need
   the full set of controls), **and its own `TTSLog` Text variable with a
   display widget bound to it, with the same three event handlers as the test
   screen** (`OnSpeakStart`/`OnSpeakEnd`/`OnError` appending to *this screen's*
   `TTSLog`). Without the handlers and a visible log here, scenario 7 looks like
   a failure (no visible events) even when the Block is correctly firing them —
   there is simply nothing on screen to show it. Add a navigation link from the
   test screen to this screen and back (e.g. two buttons, or a menu). This
   screen exists only to run on-device scenario 7 (event bridge across
   navigation) — without it, that scenario has nothing to navigate to.

Studio check: the four buttons call the six actions by name from the Logic-tab
dependency, not from the Block's element tree (the Block has nothing to call).

---

## Checklist

- [ ] Step 1: library cleared, Extensibility Configuration set
- [ ] Step 2: `TTSVoice` from JSON, **Public = Yes**
- [ ] Step 3: Block `TextToSpeechController`, **Public = Yes**, variable `HandlerId`
- [ ] Step 4: three events, Is Mandatory = No
- [ ] Step 5: three Block helper actions (Trigger Event only)
- [ ] Step 7: `Speak`, `StopSpeaking`, `OpenInstall` on the Logic tab, **Public = Yes**
- [ ] Step 8: `GetSupportedLanguages`, `GetSupportedVoices`, `IsLanguageSupported` on the Logic tab, **Public = Yes**
- [ ] Step 10: Block On Ready (+ Assign `HandlerId`) and On Destroy
- [ ] Spec task 11: local tests pass
- [ ] Step 12: publish, wait for it to finish
- [ ] Step 14: `TextToSpeechDemo` created, dependency added, Block on screen, four buttons wired, events handled, no `Speak` from On Ready
