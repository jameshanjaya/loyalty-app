export type CheckKind = "google" | "threads" | "story";
export type CheckVerdict = "pass" | "fail" | "unsure";

export type OcrFacts = {
  text: string;
  receipt: boolean | null;
  product: boolean | null;
};

export function isCheckKind(value: string | null | undefined): value is CheckKind {
  return value === "google" || value === "threads" || value === "story";
}

export function identityNeedles(name: string, email: string | null): string[] {
  const found = new Set<string>();
  for (const token of name.toLowerCase().split(/[^a-z0-9]+/)) {
    if (token.length >= 3) found.add(token);
    if (token.length >= 5) found.add(token.slice(0, 5));
  }
  const local = (email || "").toLowerCase().split("@")[0]?.replace(/[^a-z0-9]/g, "") || "";
  if (local.length >= 5) found.add(local.slice(0, 5));
  return [...found];
}

export function nameInText(text: string, name: string, email: string | null): boolean {
  const hay = text.toLowerCase();
  return identityNeedles(name, email).some((needle) => hay.includes(needle));
}

export function handleInText(text: string, handle: string): boolean {
  const needle = handle.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9]/g, "");
  if (needle.length < 3) return false;
  const hay = text.toLowerCase().replace(/[^a-z0-9]/g, "");
  return hay.includes(needle);
}

export function parseVisionJson(raw: string): OcrFacts | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { text?: unknown; receipt?: unknown; product?: unknown };
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      receipt: typeof parsed.receipt === "boolean" ? parsed.receipt : null,
      product: typeof parsed.product === "boolean" ? parsed.product : null,
    };
  } catch {
    return null;
  }
}

export function mergeFacts(parts: OcrFacts[]): OcrFacts | null {
  if (!parts.length) return null;
  return {
    text: parts.map((part) => part.text).filter(Boolean).join("\n"),
    receipt: parts.some((part) => part.receipt === true) ? true : parts.every((part) => part.receipt === false) ? false : null,
    product: parts.some((part) => part.product === true) ? true : parts.every((part) => part.product === false) ? false : null,
  };
}

export function decideMission(input: {
  kind: CheckKind;
  facts: OcrFacts | null;
  name: string;
  email: string | null;
  handle: string;
}): { verdict: CheckVerdict; code: "" | "namafoto" | "struk" | "produk" | "tag" } {
  if (!input.facts) return { verdict: "unsure", code: "" };
  if (input.kind === "google") {
    if (!input.facts.text.trim()) return { verdict: "unsure", code: "" };
    return nameInText(input.facts.text, input.name, input.email) ? { verdict: "pass", code: "" } : { verdict: "fail", code: "namafoto" };
  }
  if (input.kind === "threads") {
    if (input.facts.receipt == null || input.facts.product == null) return { verdict: "unsure", code: "" };
    if (input.facts.receipt && input.facts.product) return { verdict: "pass", code: "" };
    return { verdict: "fail", code: input.facts.product ? "struk" : "produk" };
  }
  if (!input.handle.trim()) return { verdict: "unsure", code: "" };
  if (!input.facts.text.trim()) return { verdict: "unsure", code: "" };
  return handleInText(input.facts.text, input.handle) ? { verdict: "pass", code: "" } : { verdict: "fail", code: "tag" };
}
