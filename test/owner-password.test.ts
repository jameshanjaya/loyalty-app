import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes } from "../src/crypto";
import { hashOwnerPassword, ownerPasswordOk, planOwnerPasswordChange, verifyOwnerPassword } from "../src/owner-password";

const pepper = "pepper-pin-lokal-32-karakter!!";
const envPassword = "rahasia-owner-lama";

describe("password owner", () => {
  it("hash cocok dengan password yang sama dan menolak yang lain", async () => {
    const salt = new Uint8Array(16).fill(7);
    const hash = await hashOwnerPassword("kunci-baru-1", salt, pepper);
    const saltHex = bytesToHex(salt);
    expect(await verifyOwnerPassword("kunci-baru-1", saltHex, hash, pepper)).toBe(true);
    expect(await verifyOwnerPassword("kunci-baru-2", saltHex, hash, pepper)).toBe(false);
    expect(await verifyOwnerPassword("kunci-baru-1", saltHex, hash, "pepper-lain-yang-panjang")).toBe(false);
  });

  it("kalau D1 kosong, password di secret yang dipakai", async () => {
    expect(await ownerPasswordOk({ password: envPassword, pepper, envPassword, stored: null })).toBe(true);
    expect(await ownerPasswordOk({ password: "bukan-ini-ya", pepper, envPassword, stored: null })).toBe(false);
  });

  it("setelah diganti, password secret lama ditolak dan yang baru diterima", async () => {
    const changed = await planOwnerPasswordChange({
      current: envPassword,
      next: "password-baru-8",
      confirm: "password-baru-8",
      pepper,
      envPassword,
      stored: null,
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const stored = { salt: changed.salt, hash: changed.hash };
    expect(await ownerPasswordOk({ password: envPassword, pepper, envPassword, stored })).toBe(false);
    expect(await ownerPasswordOk({ password: "password-baru-8", pepper, envPassword, stored })).toBe(true);
    expect(hexToBytes(changed.salt).length).toBe(16);
  });

  it("password sekarang yang salah ditolak dan tidak menghasilkan hash baru", async () => {
    const denied = await planOwnerPasswordChange({
      current: "salah-total",
      next: "password-baru-8",
      confirm: "password-baru-8",
      pepper,
      envPassword,
      stored: null,
    });
    expect(denied).toEqual({ ok: false, error: "passsalah" });
    const short = await planOwnerPasswordChange({
      current: envPassword,
      next: "pendek",
      confirm: "pendek",
      pepper,
      envPassword,
      stored: null,
    });
    expect(short).toEqual({ ok: false, error: "passpendek" });
    const mismatch = await planOwnerPasswordChange({
      current: envPassword,
      next: "password-baru-8",
      confirm: "password-lain-8",
      pepper,
      envPassword,
      stored: null,
    });
    expect(mismatch).toEqual({ ok: false, error: "passbeda" });
  });
});
