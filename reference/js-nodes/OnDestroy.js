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
