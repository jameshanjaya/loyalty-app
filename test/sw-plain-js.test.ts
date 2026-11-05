import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("service worker", () => {
  it("is plain JavaScript the browser can parse", () => {
    expect(() => new Function(source)).not.toThrow();
  });

  it("never intercepts page navigations", () => {
    expect(source).toContain('request.mode === "navigate") return;');
    expect(source).not.toContain("offline.html");
  });
});
