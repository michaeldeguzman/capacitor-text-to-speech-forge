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
