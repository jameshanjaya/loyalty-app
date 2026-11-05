import { decideMission, isCheckKind, mergeFacts, parseVisionJson, type CheckKind, type CheckVerdict, type OcrFacts } from "./mission-check";

export const VISION_MODEL = "@cf/meta/llama-3.2-11b-vision-instruct" as const;

const PROMPT =
  'Look at the image. Reply with JSON only, no markdown: {"text":"","receipt":false,"product":false}. text is all readable words, names, captions, and @handles. receipt is true only if a purchase receipt is visible. product is true only if a food or drink product is visible.';

export type ProofImage = { bytes: Uint8Array; type: string };

export async function readProof(ai: Ai, image: ProofImage): Promise<OcrFacts | null> {
  const result = await ai.run(VISION_MODEL, {
    prompt: PROMPT,
    image: toBase64(image.bytes),
    max_tokens: 400,
    temperature: 0,
  });
  return parseVisionJson(result.response || "");
}

export async function checkProof(
  ai: Ai | undefined,
  input: { kind: string | null | undefined; images: ProofImage[]; name: string; email: string | null; handle: string },
): Promise<{ verdict: CheckVerdict; code: "" | "namafoto" | "struk" | "produk" | "tag" }> {
  if (!isCheckKind(input.kind)) return { verdict: "pass", code: "" };
  if (!ai || !input.images.length) return { verdict: "unsure", code: "" };
  const parts: OcrFacts[] = [];
  try {
    for (const image of input.images.slice(0, 3)) {
      const facts = await readProof(ai, image);
      if (facts) parts.push(facts);
    }
  } catch {
    return { verdict: "unsure", code: "" };
  }
  return decideMission({
    kind: input.kind as CheckKind,
    facts: mergeFacts(parts),
    name: input.name,
    email: input.email,
    handle: input.handle,
  });
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}
