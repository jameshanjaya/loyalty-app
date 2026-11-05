import { describe, expect, it } from "vitest";
import { allocateFifo, allocateUpTo, expiryCopy, soonestBatch, splitLots, type LedgerLike } from "../src/expiry";
import { missionInWindow, proofKind } from "../src/points";
import { decideWaVerify, extractVerifyCode, inboundTexts } from "../src/wa";

const DAY = 86_400_000;

function row(partial: Partial<LedgerLike> & Pick<LedgerLike, "id" | "delta" | "reason">): LedgerLike {
  return {
    earnedAt: 0,
    expiresAt: 10 * DAY,
    sourceId: null,
    createdAt: 0,
    ...partial,
  };
}

describe("poin FIFO dan hangus", () => {
  const now = 1_000 * DAY;

  it("habiskan lot yang paling cepat hangus dulu", () => {
    const lots = [
      { id: "baru", remaining: 20, earnedAt: 2, expiresAt: now + 50 * DAY },
      { id: "lama", remaining: 15, earnedAt: 1, expiresAt: now + 10 * DAY },
    ];
    const plan = allocateFifo(lots, 20);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.takes.map((take) => [take.id, take.amount])).toEqual([
      ["lama", 15],
      ["baru", 5],
    ]);
    expect(plan.takes[0]?.expiresAt).toBe(now + 10 * DAY);
  });

  it("gagal kalau saldo yang masih hidup kurang", () => {
    expect(allocateFifo([{ id: "a", remaining: 5, earnedAt: 1, expiresAt: now + DAY }], 10).ok).toBe(false);
  });

  it("tarik poin boleh sebagian dan mengutamakan lot asalnya", () => {
    const lots = [
      { id: "lain", remaining: 10, earnedAt: 1, expiresAt: now + DAY },
      { id: "asal", remaining: 4, earnedAt: 9, expiresAt: now + 40 * DAY },
    ];
    const plan = allocateUpTo(lots, 12, "asal");
    expect(plan.takes.map((take) => take.id)).toEqual(["asal", "lain"]);
    expect(plan.taken).toBe(12);
  });

  it("lot yang lewat tanggal masuk due, refund bawa tanggal asalnya", () => {
    const rows = [
      row({ id: "a", delta: 30, reason: "mission", earnedAt: now - 70 * DAY, expiresAt: now - DAY }),
      row({ id: "b", delta: -10, reason: "redeem", sourceId: "a", earnedAt: now - 70 * DAY, expiresAt: now + 5 * DAY }),
      row({ id: "c", delta: 10, reason: "refund", earnedAt: now - 70 * DAY, expiresAt: now + 5 * DAY, createdAt: now }),
    ];
    const split = splitLots(rows, now);
    expect(split.due.map((lot) => lot.id)).toEqual(["a"]);
    expect(split.due[0]?.remaining).toBe(20);
    expect(split.open.find((lot) => lot.id === "c")?.expiresAt).toBe(now + 5 * DAY);
  });

  it("batch terdekat dan lencana 14 hari", () => {
    const soon = soonestBatch(
      [
        { id: "a", remaining: 15, earnedAt: 1, expiresAt: now + 11 * DAY },
        { id: "b", remaining: 10, earnedAt: 2, expiresAt: now + 11 * DAY + 3_600_000 },
        { id: "c", remaining: 40, earnedAt: 3, expiresAt: now + 40 * DAY },
      ],
      now,
    );
    expect(soon?.tenths).toBe(25);
    expect(soon?.soon).toBe(true);
    const later = soonestBatch([{ id: "d", remaining: 10, earnedAt: 1, expiresAt: now + 20 * DAY }], now);
    expect(later?.soon).toBe(false);
    expect(expiryCopy({ points: "1.5", date: "15 Nov", days: 60, soon: true }).reminder).toBe("Poin kamu mau hangus nih, buruan tukar");
    expect(expiryCopy({ points: "1.5", date: "15 Nov", days: 60, soon: true }).line).toBe("1.5 poin hangus 15 Nov · tahan 60 hari");
  });
});

describe("bukti quest dan jendela tanggal", () => {
  it("mengenali jenis bukti", () => {
    expect(proofKind({ proof_kind: "cashier", proof_screenshot: 0, proof_link: 0 })).toBe("cashier");
    expect(proofKind({ proof_kind: "", proof_screenshot: 0, proof_link: 1 })).toBe("link");
    expect(proofKind({ proof_kind: "", proof_screenshot: 1, proof_link: 1 })).toBe("upload");
  });

  it("quest di luar tanggal tidak tayang", () => {
    expect(missionInWindow(100, 200, 150)).toBe(true);
    expect(missionInWindow(100, 200, 99)).toBe(false);
    expect(missionInWindow(null, null, 1)).toBe(true);
  });
});

describe("verifikasi WhatsApp", () => {
  const now = 5_000_000;

  it("cocok kalau kode dan nomor pengirim sama", () => {
    expect(
      decideWaVerify({
        body: "Halo VERIF-123456",
        sender: "6281234564567",
        code: "VERIF-123456",
        memberWa: "081234564567",
        expiresAt: now + 1000,
        now,
        used: false,
      }),
    ).toBe("ok");
  });

  it("menolak nomor lain, kode basi, dan kode yang sudah dipakai", () => {
    expect(
      decideWaVerify({
        body: "VERIF-123456",
        sender: "628111111111",
        code: "VERIF-123456",
        memberWa: "6281234564567",
        expiresAt: now + 1000,
        now,
        used: false,
      }),
    ).toBe("wrong_number");
    expect(
      decideWaVerify({
        body: "VERIF-123456",
        sender: "6281234564567",
        code: "VERIF-123456",
        memberWa: "6281234564567",
        expiresAt: now - 1,
        now,
        used: false,
      }),
    ).toBe("expired");
    expect(
      decideWaVerify({
        body: "VERIF-123456",
        sender: "6281234564567",
        code: "VERIF-123456",
        memberWa: "6281234564567",
        expiresAt: now + 1000,
        now,
        used: true,
      }),
    ).toBe("used");
    expect(extractVerifyCode("nanti aja")).toBeNull();
  });

  it("membaca pesan masuk Cloud API", () => {
    const rows = inboundTexts({
      entry: [{ changes: [{ value: { messages: [{ from: "6281234564567", text: { body: "VERIF-000111" } }] } }] }],
    });
    expect(rows).toEqual([{ from: "6281234564567", text: "VERIF-000111" }]);
  });
});
