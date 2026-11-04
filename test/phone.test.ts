import { describe, expect, it } from "vitest";
import { maskName, maskWa } from "../src/format";
import { normalizeWa, validPin, weakPin } from "../src/phone";

describe("nomor WhatsApp", () => {
  it("menerima format lokal, +62, dan 62", () => {
    expect(normalizeWa("0812-3456-4567")).toBe("6281234564567");
    expect(normalizeWa("+62 812 3456 4567")).toBe("6281234564567");
    expect(normalizeWa("6281234564567")).toBe("6281234564567");
  });

  it("menolak nomor yang bukan HP Indonesia", () => {
    expect(normalizeWa("0215551234")).toBeNull();
    expect(normalizeWa("0812")).toBeNull();
    expect(normalizeWa("hello")).toBeNull();
  });

  it("PIN lemah dan nama tersamar", () => {
    expect(validPin("2468")).toBe(true);
    expect(validPin("12")).toBe(false);
    expect(weakPin("1234")).toBe(true);
    expect(weakPin("0000")).toBe(true);
    expect(weakPin("2468")).toBe(false);
    expect(maskName("Rina Pratiwi", "6281234564521")).toBe("Rina ****21");
    expect(maskWa("6281234564567")).toBe("0812-xxxx-4567");
  });
});
