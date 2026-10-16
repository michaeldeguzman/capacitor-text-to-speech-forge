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
