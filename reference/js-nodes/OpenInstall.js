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
