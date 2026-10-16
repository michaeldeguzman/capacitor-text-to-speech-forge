// Guards against drift: every file in reference/js-nodes/ must match the JS
// block in design.md that it was copied from, and so must the build sheet.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JS_NODES_DIR } from "./harness.js";

const docsDir = path.resolve(JS_NODES_DIR, "../../docs");
const design = readFileSync(path.join(docsDir, "design.md"), "utf8");
const sheet = readFileSync(path.join(docsDir, "studio-build-sheet.md"), "utf8");

const HEADINGS = {
  Speak: "#### Speak\n",
  StopSpeaking: "#### StopSpeaking",
  OpenInstall: "#### OpenInstall",
  GetSupportedLanguages: "#### GetSupportedLanguages",
  GetSupportedVoices: "#### GetSupportedVoices",
  IsLanguageSupported: "#### IsLanguageSupported",
  OnReady: "**On Ready**",
  OnDestroy: "**On Destroy**"
};

function blockAfter(md, heading) {
  const at = md.indexOf(heading);
  if (at < 0) throw new Error(`heading not found: ${heading}`);
  const open = md.indexOf("```javascript\n", at) + "```javascript\n".length;
  return md.slice(open, md.indexOf("```", open));
}

// Build-sheet blocks are indented inside list items, so compare trimmed lines.
const normalize = (code) =>
  code
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");

const sheetBlocks = [...sheet.matchAll(/```javascript\n([\s\S]*?)```/g)].map((m) => normalize(m[1]));

describe("reference JS nodes stay in sync", () => {
  for (const [name, heading] of Object.entries(HEADINGS)) {
    it(`${name}.js matches design.md and the build sheet`, () => {
      const file = readFileSync(path.join(JS_NODES_DIR, `${name}.js`), "utf8");
      expect(file).toBe(blockAfter(design, heading));
      expect(sheetBlocks).toContain(normalize(file));
    });
  }
});
