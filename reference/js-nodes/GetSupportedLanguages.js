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
