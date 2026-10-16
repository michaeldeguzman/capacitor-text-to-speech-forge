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
