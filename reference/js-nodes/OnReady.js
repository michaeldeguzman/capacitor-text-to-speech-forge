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
