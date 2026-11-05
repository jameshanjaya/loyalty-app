import { describe, expect, it } from "vitest";
import { decideMission, handleInText, nameInText, parseVisionJson } from "../src/mission-check";

describe("cek bukti bonus stamp", () => {
  it("nama review cocok dengan nama atau potongan email", () => {
    expect(nameInText("Review by Wendy A.", "Wendy Angelina", "wendyangelinajakup@gmail.com")).toBe(true);
    expect(nameInText("posted by wendyangel", "", "wendyangelinajakup@gmail.com")).toBe(true);
    expect(nameInText("Anonim", "Wendy Angelina", "wendyangelinajakup@gmail.com")).toBe(false);
    expect(decideMission({ kind: "google", facts: { text: "Wendy", receipt: null, product: null }, name: "Wendy Angelina", email: null, handle: "" }).verdict).toBe("pass");
    expect(decideMission({ kind: "google", facts: { text: "Budi", receipt: null, product: null }, name: "Wendy Angelina", email: "wendyangelinajakup@gmail.com", handle: "" }).code).toBe("namafoto");
    expect(decideMission({ kind: "google", facts: null, name: "Wendy", email: null, handle: "" }).verdict).toBe("unsure");
  });

  it("threads butuh struk dan produk", () => {
    expect(decideMission({ kind: "threads", facts: { text: "", receipt: true, product: true }, name: "", email: null, handle: "" }).verdict).toBe("pass");
    expect(decideMission({ kind: "threads", facts: { text: "", receipt: true, product: false }, name: "", email: null, handle: "" }).code).toBe("produk");
    expect(decideMission({ kind: "threads", facts: { text: "", receipt: false, product: true }, name: "", email: null, handle: "" }).code).toBe("struk");
    expect(decideMission({ kind: "threads", facts: { text: "", receipt: null, product: true }, name: "", email: null, handle: "" }).verdict).toBe("unsure");
  });

  it("story lolos kalau handle keliatan, dengan atau tanpa @", () => {
    expect(handleInText("story @loft25.matchastudio", "loft25.matchastudio")).toBe(true);
    expect(handleInText("tag loft25matchastudio", "@loft25.matchastudio")).toBe(true);
    expect(handleInText("no tag", "@krispyporkk")).toBe(false);
    expect(decideMission({ kind: "story", facts: { text: "@sotooseng.bangjem", receipt: null, product: null }, name: "", email: null, handle: "sotooseng.bangjem" }).verdict).toBe("pass");
    expect(decideMission({ kind: "story", facts: { text: "story doang", receipt: null, product: null }, name: "", email: null, handle: "@krispyporkk" }).code).toBe("tag");
    expect(decideMission({ kind: "story", facts: { text: "@krispyporkk", receipt: null, product: null }, name: "", email: null, handle: "" }).verdict).toBe("unsure");
  });

  it("json vision yang dibungkus teks tetap kebaca", () => {
    expect(parseVisionJson('ok {"text":"Wendy","receipt":false,"product":true}')).toEqual({
      text: "Wendy",
      receipt: false,
      product: true,
    });
    expect(parseVisionJson("bukan json")).toBeNull();
  });
});
