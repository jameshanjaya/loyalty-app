import { describe, expect, it } from "vitest";
import { birthdayEditAllowed, decidePhone, profileComplete } from "../src/profile";
import { googleAuthUrl } from "../src/google";

describe("profil Google", () => {
  it("profil baru belum lengkap sebelum nama, WA, dan tanggal lahir ada", () => {
    expect(profileComplete({ name: "Ayu", wa: null, birthday: null })).toBe(false);
    expect(profileComplete({ name: "Ayu", wa: "628123", birthday: null })).toBe(false);
    expect(profileComplete({ name: "Ayu", wa: "628123", birthday: "1998-11-04" })).toBe(true);
  });

  it("nomor baru dibuat, nomor lama dihubungkan, nomor yang sudah punya Google ditolak", () => {
    expect(decidePhone(null)).toBe("create");
    expect(decidePhone({ googleSub: null })).toBe("link");
    expect(decidePhone({ googleSub: "google-123" })).toBe("taken");
  });

  it("pelanggan tidak bisa mengubah tanggal lahir yang sudah tersimpan", () => {
    expect(birthdayEditAllowed(null, false)).toBe(true);
    expect(birthdayEditAllowed("1998-11-04", false)).toBe(false);
    expect(birthdayEditAllowed("1998-11-04", true)).toBe(true);
  });

  it("tautan Google memuat client id dan alamat kembali", () => {
    const url = new URL(
      googleAuthUrl({
        clientId: "client-demo.apps.googleusercontent.com",
        redirectUri: "http://localhost:8787/auth/google/callback",
        state: "state1",
        nonce: "nonce1",
      }),
    );
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-demo.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8787/auth/google/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.has("hd")).toBe(false);
    expect(url.searchParams.get("nonce")).toBe("nonce1");
  });
});
