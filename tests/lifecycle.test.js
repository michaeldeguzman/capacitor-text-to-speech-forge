import { afterEach, describe, expect, it, vi } from "vitest";
import { createEnv, runNode, settle } from "./harness.js";

function blockActions() {
  const calls = [];
  return {
    calls,
    actions: {
      TriggerOnSpeakStart: (...args) => calls.push(["start", ...args]),
      TriggerOnSpeakEnd: (...args) => calls.push(["end", ...args]),
      TriggerOnError: (...args) => calls.push(["error", ...args])
    }
  };
}

const fire = (type, detail) => window.dispatchEvent(new CustomEvent(type, { detail }));

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.window;
});

describe("Block On Ready", () => {
  it("registers listeners, outputs a HandlerId, and resolves", async () => {
    createEnv();
    const { actions } = blockActions();
    const run = await runNode("OnReady", {}, actions);
    expect(run.resolveCount).toBe(1);
    expect(typeof run.params.HandlerId).toBe("string");
    expect(run.params.HandlerId.length).toBeGreaterThan(0);
    expect(Object.keys(window._ttsHandlers)).toEqual([run.params.HandlerId]);
  });

  it("maps each Signal to the matching helper with coerced payloads", async () => {
    createEnv();
    const { calls, actions } = blockActions();
    await runNode("OnReady", {}, actions);
    fire("ctts:speakstart");
    fire("ctts:speakend", { success: true });
    fire("ctts:speakend", { success: 0 });
    fire("ctts:speakend");
    fire("ctts:error", { message: "boom" });
    fire("ctts:error", { message: 42 });
    fire("ctts:error");
    expect(calls).toEqual([
      ["start"],
      ["end", true],
      ["end", false],
      ["end", false],
      ["error", "boom"],
      ["error", "42"],
      ["error", ""]
    ]);
  });

  it("gives each Block instance its own HandlerId", async () => {
    createEnv();
    const a = await runNode("OnReady", {}, blockActions().actions);
    const b = await runNode("OnReady", {}, blockActions().actions);
    expect(a.params.HandlerId).not.toBe(b.params.HandlerId);
  });
});

describe("Block On Destroy", () => {
  it("keeps the next screen's listeners when the old screen is destroyed last", async () => {
    createEnv();
    const A = blockActions();
    const B = blockActions();
    const a = await runNode("OnReady", {}, A.actions); // old screen
    await runNode("OnReady", {}, B.actions); // new screen, ready before A is destroyed
    await runNode("OnDestroy", { HandlerId: a.params.HandlerId });
    fire("ctts:speakstart");
    expect(A.calls).toEqual([]);
    expect(B.calls).toEqual([["start"]]);
    expect(Object.keys(window._ttsHandlers)).toHaveLength(1);
  });

  it("cancels the current item, clears the queue, stops, and resolves last", async () => {
    const { plugin } = createEnv();
    const ready = await runNode("OnReady", {}, blockActions().actions);
    const current = { text: "speaking" };
    window._ttsCurrent = current;
    window._ttsQueue = [{ text: "a" }, { text: "b" }];
    let stateAtResolve = null;
    const run = await runNode("OnDestroy", { HandlerId: ready.params.HandlerId }, {}, () => {
      stateAtResolve = {
        queue: window._ttsQueue.length,
        stops: plugin.callsOf("stop").length,
        handlers: Object.keys(window._ttsHandlers).length
      };
    });
    expect(run.resolveCount).toBe(1);
    expect(current.cancelled).toBe(true);
    expect(stateAtResolve).toEqual({ queue: 0, stops: 1, handlers: 0 });
  });

  it("ignores a stop() rejection", async () => {
    const { plugin } = createEnv();
    plugin.impl.stop = () => Promise.reject(new Error("stop failed"));
    const ready = await runNode("OnReady", {}, blockActions().actions);
    const run = await runNode("OnDestroy", { HandlerId: ready.params.HandlerId });
    await settle(1);
    expect(run.resolveCount).toBe(1);
  });

  it("skips stop() but still cleans up when the plugin is missing", async () => {
    createEnv({ plugin: "noCapacitorPlugins" });
    const ready = await runNode("OnReady", {}, blockActions().actions);
    window._ttsQueue = [{ text: "a" }];
    const run = await runNode("OnDestroy", { HandlerId: ready.params.HandlerId });
    expect(run.resolveCount).toBe(1);
    expect(window._ttsQueue).toEqual([]);
    expect(Object.keys(window._ttsHandlers)).toHaveLength(0);
  });

  it("does nothing harmful for an unknown HandlerId", async () => {
    createEnv();
    const B = blockActions();
    await runNode("OnReady", {}, B.actions);
    const run = await runNode("OnDestroy", { HandlerId: "" });
    fire("ctts:speakstart");
    expect(run.resolveCount).toBe(1);
    expect(B.calls).toEqual([["start"]]);
  });
});
