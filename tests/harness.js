// Test harness for the ODC JavaScript-node bodies in reference/js-nodes/.
//
// Each reference file is the exact body of an ODC JavaScript node. ODC runs it
// with $parameters, $resolve and $actions in scope, so here it runs as the body
// of an async function taking those three arguments. `window` is a fresh
// EventTarget per test, with dispatchEvent calls recorded, and an optional mock
// of window.CapacitorPlugins.TextToSpeech that behaves like v3.0.0 on iOS:
// a cancelled speak() resolves (it does not reject).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const JS_NODES_DIR = path.resolve(here, "../reference/js-nodes");

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const cache = new Map();

export function loadNode(name) {
  if (!cache.has(name)) {
    const src = readFileSync(path.join(JS_NODES_DIR, `${name}.js`), "utf8");
    cache.set(name, new AsyncFunction("$parameters", "$resolve", "$actions", src));
  }
  return cache.get(name);
}

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets pending promise callbacks and zero-delay timers run.
export async function settle(rounds = 3) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

// Mock of the v3.0.0 plugin. By default speak() stays pending until the test
// finishes, fails, or stops it. stop() resolves at once and resolves the
// in-flight speak() on the next tick, like the iOS cancel callback.
export function createPluginMock() {
  const calls = [];
  const inflight = [];
  const impl = {};

  const record = (name, arg) => calls.push(arg === undefined ? [name] : [name, arg]);

  const mock = {
    calls,
    inflight,
    impl,
    speak(options) {
      record("speak", options);
      if (impl.speak) return impl.speak(options);
      const d = deferred();
      inflight.push(d);
      return d.promise;
    },
    stop() {
      record("stop");
      if (impl.stop) return impl.stop();
      const live = inflight.splice(0);
      setTimeout(() => live.forEach((d) => d.resolve()), 0);
      return Promise.resolve();
    },
    getSupportedLanguages() {
      record("getSupportedLanguages");
      return impl.getSupportedLanguages ? impl.getSupportedLanguages() : Promise.resolve({ languages: [] });
    },
    getSupportedVoices() {
      record("getSupportedVoices");
      return impl.getSupportedVoices ? impl.getSupportedVoices() : Promise.resolve({ voices: [] });
    },
    isLanguageSupported(options) {
      record("isLanguageSupported", options);
      return impl.isLanguageSupported ? impl.isLanguageSupported(options) : Promise.resolve({ supported: false });
    },
    openInstall() {
      record("openInstall");
      return impl.openInstall ? impl.openInstall() : Promise.resolve();
    },
    // Test controls for the in-flight speak().
    finishCurrent() {
      const d = inflight.shift();
      if (d) d.resolve();
    },
    failCurrent(message) {
      const d = inflight.shift();
      if (d) d.reject(new Error(message));
    },
    callsOf(name) {
      return calls.filter((c) => c[0] === name);
    }
  };
  return mock;
}

// plugin: "present" | "noCapacitorPlugins" | "noTextToSpeech"
export function createEnv({ plugin = "present" } = {}) {
  const win = new EventTarget();
  const signals = [];
  const dispatch = win.dispatchEvent.bind(win);
  win.dispatchEvent = (event) => {
    signals.push({ type: event.type, detail: event.detail });
    return dispatch(event);
  };

  let mock = null;
  if (plugin === "present") {
    mock = createPluginMock();
    win.CapacitorPlugins = { TextToSpeech: mock };
  } else if (plugin === "noTextToSpeech") {
    win.CapacitorPlugins = {};
  }

  globalThis.window = win;
  return { win, signals, plugin: mock };
}

// Runs a JS node body. Returns the $parameters object and resolve tracking.
export async function runNode(name, params = {}, actions = {}, onResolve) {
  const state = { resolveCount: 0 };
  const $resolve = () => {
    state.resolveCount += 1;
    if (onResolve) onResolve();
  };
  await loadNode(name)(params, $resolve, actions);
  return {
    params,
    get resolved() {
      return state.resolveCount > 0;
    },
    get resolveCount() {
      return state.resolveCount;
    }
  };
}

// Signal log as compact strings: "start", "end:true", "error:<message>".
export function signalLog(signals) {
  return signals.map((s) => {
    if (s.type === "ctts:speakstart") return "start";
    if (s.type === "ctts:speakend") return `end:${s.detail.success}`;
    if (s.type === "ctts:error") return `error:${s.detail.message}`;
    return s.type;
  });
}

export const PLUGIN_NOT_FOUND = "TextToSpeech plugin not found on window.CapacitorPlugins.";
