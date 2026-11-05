import { describe, expect, it } from "vitest";
import { membersCsv, membersXlsx, type ExportRow } from "../src/export";

const rows: ExportRow[] = [
  {
    name: "Rina, Pratiwi",
    wa: "0812 3456 4567",
    email: "rina@example.com",
    birthday: "1998-11-04",
    joined: "Sep 2026",
    method: "wa",
    stamps: "Loft25 6/10",
    rewards: "5",
    lastVisit: "4 Nov",
    pointsExpiry: "1 stamp · 15 Nov",
    waVerified: "ya",
    promoConsent: "belum",
  },
];

describe("unduh database member", () => {
  it("CSV memuat kolom lengkap dan mengutip koma", () => {
    const csv = membersCsv(rows);
    expect(csv.split("\n")[0]).toBe("nama,wa,email,ulang_tahun,gabung,cara_gabung,stamp,reward_ditukar,terakhir_datang,poin_hangus,wa_terverifikasi,persetujuan_promo");
    expect(csv).toContain("1 stamp · 15 Nov");
    expect(csv).toContain("ya");
    expect(csv).toContain("belum");
    expect(csv).toContain('"Rina, Pratiwi"');
    expect(csv).toContain("rina@example.com");
    expect(csv).toContain("1998-11-04");
    expect(csv).toContain("Loft25 6/10");
  });

  it("XLSX adalah file zip yang berisi nama member", () => {
    const bytes = membersXlsx(rows);
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("Rina, Pratiwi");
    expect(text).toContain("ulang_tahun");
  });
});