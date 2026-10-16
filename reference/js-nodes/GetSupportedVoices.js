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
