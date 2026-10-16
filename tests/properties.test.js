import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import {
  createEnv,
  deferred,
  PLUGIN_NOT_FOUND,
  runNode,
  settle,
  signalLog
} from "./harness.js";

const RUNS = { numRuns: 100 };

// Generators
const nonBlankText = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() !== "");
const blankText = fc.oneof(
  fc.array(fc.constantFrom("", " ", "\t", "\n"), { maxLength: 5 }).map((a) => a.join("")),
  fc.constant(null),
  fc.constant(undefined)
);
const priorItem = fc.record({ text: fc.string({ maxLength: 8 }) });
const priorQueue = fc.array(priorItem, { maxLength: 5 });
// A Decimal can reach JavaScript as an OutSystems object with toNumber().
const decimalObject = (n) => ({ toNumber: () => n, toString: () => String(n) });
const numericInput = fc.oneof(
  fc.double({ noNaN: false }),
  fc.integer({ min: -3, max: 10 }),
  fc.constantFrom(0, -1, 1, 1.0),
  fc.double({ min: -5, max: 5, noNaN: true }).map(decimalObject),
  fc.constantFrom(undefined, null)
);
const toNum = (v) => (v != null && typeof v.toNumber === "function" ? v.toNumber() : Number(v));
const positiveOr = (v, fallback) => {
  const n = toNum(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window;
});

describe("CapacitorTextToSpeech JS nodes", () => {
  // Feature: CapacitorTextToSpeech, Property 1: Add preserves FIFO order
  it("Property 1: Add preserves FIFO order", async () => {
    await fc.assert(
      fc.asyncProperty(priorQueue, nonBlankText, fc.constantFrom(1, 2, -1), async (prior, text, mode) => {
        createEnv();
        window._ttsQueue = prior.map((p) => ({ ...p }));
        window._ttsSpeaking = true; // a loop is "running", so nothing is shifted
        await runNode("Speak", { Text: text, QueueMode: mode });
        const q = window._ttsQueue;
        expect(q.length).toBe(prior.length + 1);
        expect(q.slice(0, prior.length)).toEqual(prior);
        expect(q[q.length - 1].text).toBe(text);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 2: Flush clears, cancels the current item, stops, then enqueues
  it("Property 2: Flush clears, cancels current, stops, then enqueues", async () => {
    await fc.assert(
      fc.asyncProperty(priorQueue, fc.boolean(), nonBlankText, async (prior, hasCurrent, text) => {
        const { plugin } = createEnv();
        const current = hasCurrent ? { text: "current" } : null;
        window._ttsQueue = prior.map((p) => ({ ...p }));
        window._ttsCurrent = current;
        window._ttsSpeaking = true;
        await runNode("Speak", { Text: text, QueueMode: 0 });
        expect(window._ttsQueue).toHaveLength(1);
        expect(window._ttsQueue[0].text).toBe(text);
        expect(plugin.callsOf("stop")).toHaveLength(1);
        if (current) expect(current.cancelled).toBe(true);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 3: Queue item field fallbacks
  it("Property 3: queue item field fallbacks", async () => {
    await fc.assert(
      fc.asyncProperty(
        nonBlankText,
        fc.oneof(fc.constant(""), fc.constant(undefined), fc.string({ minLength: 1, maxLength: 6 })),
        numericInput,
        numericInput,
        numericInput,
        fc.oneof(fc.constant(""), fc.constant(undefined), fc.constantFrom("ambient", "playback")),
        async (text, lang, rate, pitch, volume, category) => {
          createEnv();
          window._ttsSpeaking = true;
          await runNode("Speak", { Text: text, Lang: lang, Rate: rate, Pitch: pitch, Volume: volume, Category: category, QueueMode: 1 });
          const item = window._ttsQueue[0];
          expect(item.text).toBe(text);
          expect(item.lang).toBe(lang || "en-US");
          expect(item.rate).toBe(positiveOr(rate, 1.0));
          expect(item.pitch).toBe(positiveOr(pitch, 1.0));
          expect(item.volume).toBe(positiveOr(volume, 1.0));
          expect(item.category).toBe(category || "ambient");
          for (const v of [item.rate, item.pitch, item.volume]) expect(typeof v).toBe("number");
        }
      ),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 4: voice present iff VoiceIndex is a non-negative integer
  it("Property 4: voice present iff VoiceIndex is a non-negative integer", async () => {
    const voiceInput = fc.oneof(
      fc.integer({ min: -10, max: 60 }),
      fc.double({ min: -5, max: 60 }),
      fc.integer({ min: 0, max: 20 }).map(decimalObject),
      fc.constantFrom(undefined, null, -1)
    );
    await fc.assert(
      fc.asyncProperty(nonBlankText, voiceInput, async (text, voiceIndex) => {
        createEnv();
        window._ttsSpeaking = true;
        await runNode("Speak", { Text: text, VoiceIndex: voiceIndex, QueueMode: 1 });
        const item = window._ttsQueue[0];
        const n = toNum(voiceIndex);
        if (Number.isInteger(n) && n >= 0) {
          expect(item.voice).toBe(n);
        } else {
          expect("voice" in item).toBe(false);
        }
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 5: Exactly one start and one end per drained item
  it("Property 5: exactly one start and one end per drained item", async () => {
    const outcome = fc.constantFrom("resolve", "reject", "cancel");
    await fc.assert(
      fc.asyncProperty(fc.array(outcome, { minLength: 1, maxLength: 5 }), async (outcomes) => {
        const { plugin, signals } = createEnv();
        for (let i = 0; i < outcomes.length; i++) {
          await runNode("Speak", { Text: `t${i}`, QueueMode: 1 });
        }
        const expected = [];
        for (let i = 0; i < outcomes.length; i++) {
          await settle();
          expect(plugin.inflight).toHaveLength(1);
          expect(plugin.callsOf("speak")[i][1].text).toBe(`t${i}`);
          const o = outcomes[i];
          expected.push("start");
          if (o === "resolve") {
            plugin.finishCurrent();
            expected.push("end:true");
          } else if (o === "reject") {
            plugin.failCurrent(`boom${i}`);
            expected.push(`error:boom${i}`, "end:false");
          } else {
            window._ttsCurrent.cancelled = true;
            plugin.finishCurrent(); // a cancelled speak() resolves on iOS
            expected.push("end:false");
          }
        }
        await settle();
        expect(signalLog(signals)).toEqual(expected);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 6: Single drain loop, guard released
  it("Property 6: single drain loop, each item spoken once, guard released", async () => {
    const step = fc.constantFrom("speak", "finish");
    await fc.assert(
      fc.asyncProperty(fc.array(step, { minLength: 1, maxLength: 12 }), async (steps) => {
        const { plugin } = createEnv();
        let n = 0;
        for (const s of steps) {
          if (s === "speak") await runNode("Speak", { Text: `t${n++}`, QueueMode: 1 });
          else plugin.finishCurrent();
          await settle(1);
          expect(plugin.inflight.length).toBeLessThanOrEqual(1);
        }
        while (window._ttsSpeaking) {
          plugin.finishCurrent();
          await settle(1);
        }
        const spoken = plugin.callsOf("speak").map((c) => c[1].text);
        expect(spoken).toEqual(Array.from({ length: n }, (_, i) => `t${i}`));
        if (n === 0) {
          // No Speak ran, so the loop never started and the globals were never set.
          expect(window._ttsSpeaking).toBeUndefined();
        } else {
          expect(window._ttsSpeaking).toBe(false);
          expect(window._ttsCurrent).toBe(null);
        }
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 7: StopSpeaking clears, cancels, and never ends twice
  it("Property 7: StopSpeaking clears, cancels, and never ends twice", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 4 }), async (count) => {
        const { plugin, signals } = createEnv();
        let queueAtStop = null;
        plugin.impl.stop = () => {
          queueAtStop = window._ttsQueue.length;
          const live = plugin.inflight.splice(0);
          setTimeout(() => live.forEach((d) => d.resolve()), 0);
          return Promise.resolve();
        };
        for (let i = 0; i < count; i++) {
          await runNode("Speak", { Text: `t${i}`, QueueMode: 1 });
        }
        await settle();
        signals.length = 0;
        await runNode("StopSpeaking");
        expect(queueAtStop).toBe(0);
        await settle();
        const log = signalLog(signals);
        if (count === 0) {
          expect(log).toEqual([]);
        } else {
          expect(log).toEqual(["end:false"]);
          expect(plugin.callsOf("speak")).toHaveLength(1);
        }
        expect(window._ttsSpeaking).toBeFalsy();
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 8: Plugin-undefined guard
  it("Property 8: plugin-undefined guard degrades without throwing", async () => {
    const action = fc.constantFrom(
      "Speak",
      "StopSpeaking",
      "OpenInstall",
      "GetSupportedLanguages",
      "GetSupportedVoices",
      "IsLanguageSupported"
    );
    await fc.assert(
      fc.asyncProperty(action, fc.constantFrom("noCapacitorPlugins", "noTextToSpeech"), async (name, variant) => {
        const { signals } = createEnv({ plugin: variant });
        const params = name === "Speak" ? { Text: "hi" } : name === "IsLanguageSupported" ? { Lang: "en-US" } : {};
        const run = await runNode(name, params);
        await settle(1);
        expect(run.resolveCount).toBe(1);
        const log = signalLog(signals);
        if (["Speak", "StopSpeaking", "OpenInstall"].includes(name)) {
          expect(log).toEqual([`error:${PLUGIN_NOT_FOUND}`]);
        } else {
          expect(log).toEqual([]);
          if (name === "GetSupportedLanguages") expect(run.params.LanguagesJSON).toBe("[]");
          if (name === "GetSupportedVoices") expect(run.params.VoicesJSON).toBe("[]");
          if (name === "IsLanguageSupported") expect(run.params.Supported).toBe(false);
        }
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 9: Query result and error mapping
  it("Property 9: query result and error mapping", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const langResult = fc.oneof(
      fc.record({ languages: fc.array(fc.string({ maxLength: 6 }), { maxLength: 5 }) }),
      fc.constant({}),
      fc.constant({ languages: null })
    );
    await fc.assert(
      fc.asyncProperty(langResult, fc.anything(), fc.boolean(), async (result, supported, fail) => {
        const { plugin, signals } = createEnv();
        plugin.impl.getSupportedLanguages = () => (fail ? Promise.reject(new Error("x")) : Promise.resolve(result));
        plugin.impl.isLanguageSupported = () => (fail ? Promise.reject(new Error("x")) : Promise.resolve({ supported }));
        const langs = await runNode("GetSupportedLanguages");
        const sup = await runNode("IsLanguageSupported", { Lang: "en-US" });
        await settle(1);
        expect(langs.params.LanguagesJSON).toBe(fail ? "[]" : JSON.stringify(result.languages || []));
        expect(sup.params.Supported).toBe(fail ? false : !!supported);
        expect(plugin.callsOf("isLanguageSupported")[0][1]).toEqual({ lang: "en-US" });
        expect(signals).toEqual([]);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 10: Voices JSON order and mapping
  it("Property 10: voices JSON preserves order and mapping", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const voice = fc.record(
      {
        name: fc.string({ maxLength: 6 }),
        lang: fc.string({ maxLength: 6 }),
        default: fc.boolean(),
        localService: fc.boolean(),
        voiceURI: fc.string({ maxLength: 6 })
      },
      { requiredKeys: [] }
    );
    const result = fc.oneof(fc.record({ voices: fc.array(voice, { maxLength: 6 }) }), fc.constant({}));
    await fc.assert(
      fc.asyncProperty(result, fc.boolean(), async (res, fail) => {
        const { plugin, signals } = createEnv();
        plugin.impl.getSupportedVoices = () => (fail ? Promise.reject(new Error("x")) : Promise.resolve(res));
        const run = await runNode("GetSupportedVoices");
        await settle(1);
        const expected = fail
          ? []
          : (res.voices || []).map((v, i) => ({
              VoiceIndex: i,
              Name: v.name || "",
              Lang: v.lang || "",
              IsDefault: !!v.default,
              IsLocalService: !!v.localService,
              VoiceURI: v.voiceURI || ""
            }));
        expect(JSON.parse(run.params.VoicesJSON)).toEqual(expected);
        expect(signals).toEqual([]);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 11: Resolve timing
  it("Property 11: resolve timing matches each action's contract", async () => {
    const action = fc.constantFrom(
      "Speak",
      "StopSpeaking",
      "OpenInstall",
      "GetSupportedLanguages",
      "GetSupportedVoices",
      "IsLanguageSupported"
    );
    await fc.assert(
      fc.asyncProperty(action, async (name) => {
        const { plugin } = createEnv();
        const hold = deferred();
        for (const m of ["stop", "openInstall", "getSupportedLanguages", "getSupportedVoices", "isLanguageSupported"]) {
          plugin.impl[m] = () => hold.promise;
        }
        const params = name === "Speak" ? { Text: "hi" } : name === "IsLanguageSupported" ? { Lang: "en-US" } : {};
        const run = await runNode(name, params);
        await settle(1);
        const fireAndForget = ["Speak", "StopSpeaking", "OpenInstall"].includes(name);
        expect(run.resolved).toBe(fireAndForget);
        hold.resolve({ languages: [], voices: [], supported: true });
        await settle(1);
        expect(run.resolveCount).toBe(1);
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 12: OpenInstall rejection is warned, not signalled
  it("Property 12: OpenInstall rejection is warned, not signalled", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 12 }), async (message) => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { plugin, signals } = createEnv();
        plugin.impl.openInstall = () => Promise.reject(new Error(message));
        const run = await runNode("OpenInstall");
        await settle(1);
        expect(run.resolveCount).toBe(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0][0])).toContain(message);
        expect(signals).toEqual([]);
        warn.mockRestore();
      }),
      RUNS
    );
  });

  // Feature: CapacitorTextToSpeech, Property 13: Empty text is rejected
  it("Property 13: empty or whitespace text is rejected", async () => {
    await fc.assert(
      fc.asyncProperty(blankText, priorQueue, async (text, prior) => {
        const { plugin, signals } = createEnv();
        window._ttsQueue = prior.map((p) => ({ ...p }));
        const run = await runNode("Speak", { Text: text, QueueMode: 0 });
        expect(run.resolveCount).toBe(1);
        expect(signalLog(signals)).toEqual(["error:Text is required."]);
        expect(window._ttsQueue).toEqual(prior);
        expect(plugin.calls).toEqual([]);
      }),
      RUNS
    );
  });

  // Example: lazy queue init (task 9.15)
  it("creates window._ttsQueue when it does not exist", async () => {
    createEnv();
    expect(window._ttsQueue).toBeUndefined();
    await runNode("Speak", { Text: "hi", QueueMode: 1 });
    expect(Array.isArray(window._ttsQueue)).toBe(true);
  });
});
