---
inclusion: always
---

# Structure conventions

Layout of the CapacitorTextToSpeech Mobile Library, following
`odc-mobile-rules.md`.

- One Mobile Library per plugin wrapper (CapacitorTextToSpeech), created and
  built in ODC Studio.
- One Public Block per plugin surface (TextToSpeechController). The Block holds
  only:
  - Events (OnSpeakerStart, OnSpeakerEnd(Success), OnError(Message)), Is Mandatory = No.
  - Thin "Trigger" helper client actions that only Trigger Event.
  - One internal Text variable `HandlerId`.
  - On Ready JS that registers this instance's `window` listeners (keyed by
    `HandlerId`) calling the helpers via `$actions`, and On Destroy JS that
    removes only this instance's listeners and stops speech.
- All plugin actions are Public client actions on the Logic tab, each with a
  single JS node: Speak, StopSpeaking, OpenInstall (no outputs, dispatch `ctts:*`
  window events) and GetSupportedLanguages, GetSupportedVoices,
  IsLanguageSupported (outputs via JSON Deserialize or Assign, no events).
- Structures used by Public actions (TTSVoice) are Public.
- The consuming screen places one Block to receive the events and calls the
  Public actions directly.
